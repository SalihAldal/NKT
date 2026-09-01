import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import { prisma } from '../database/prisma.js';
import { AppError, ERR } from '../common/response.js';
import type { AuthProvider, AccountType, User, UserProfile, Entitlement } from '@prisma/client';

const SALT_ROUNDS = 12;

export interface TokenPayload {
  sub: string;
  type: 'access' | 'refresh';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSessionDto {
  user: User;
  profile: UserProfile;
  entitlement: Entitlement;
  tokens: AuthTokens;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(userId: string): string {
  const opts: SignOptions = { expiresIn: config.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId, type: 'access' } satisfies TokenPayload, config.JWT_ACCESS_SECRET, opts);
}

export function signRefreshToken(userId: string): string {
  const opts: SignOptions = { expiresIn: config.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign({ sub: userId, type: 'refresh' } satisfies TokenPayload, config.JWT_REFRESH_SECRET, opts);
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, config.JWT_ACCESS_SECRET) as TokenPayload;
    if (payload.type !== 'access') throw new Error('Invalid token type');
    return payload;
  } catch {
    throw ERR.UNAUTHORIZED;
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    const payload = jwt.verify(token, config.JWT_REFRESH_SECRET) as TokenPayload;
    if (payload.type !== 'refresh') throw new Error('Invalid token type');
    return payload;
  } catch {
    throw ERR.UNAUTHORIZED;
  }
}

function parseExpiry(exp: string): Date {
  const match = exp.match(/^(\d+)([dhms])$/);
  if (!match) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [, num, unit] = match;
  const n = parseInt(num!, 10);
  const ms = unit === 'd' ? n * 86400000 : unit === 'h' ? n * 3600000 : unit === 'm' ? n * 60000 : n * 1000;
  return new Date(Date.now() + ms);
}

async function createSession(userId: string, ipAddress?: string): Promise<AuthTokens> {
  const refreshToken = signRefreshToken(userId);
  await prisma.userSession.create({
    data: {
      userId,
      refreshToken,
      expiresAt: parseExpiry(config.JWT_REFRESH_EXPIRES_IN),
      ipAddress,
    },
  });
  return { accessToken: signAccessToken(userId), refreshToken };
}

async function loadSession(userId: string): Promise<AuthSessionDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === 'DELETED') throw ERR.UNAUTHORIZED;
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) throw ERR.NOT_FOUND;
  let entitlement = await prisma.entitlement.findUnique({ where: { userId } });
  if (!entitlement) {
    entitlement = await prisma.entitlement.create({ data: { userId, status: 'free' } });
  }
  return { user, profile, entitlement, tokens: { accessToken: '', refreshToken: '' } };
}

export async function register(data: {
  email: string;
  password: string;
  displayName: string;
  username: string;
}, ipAddress?: string): Promise<AuthSessionDto> {
  const existing = await prisma.userProfile.findUnique({ where: { username: data.username.toLowerCase() } });
  if (existing) throw new AppError('USERNAME_TAKEN', 'Username already taken', 409);

  const emailExists = await prisma.authIdentity.findFirst({
    where: { provider: 'EMAIL', email: data.email.toLowerCase() },
  });
  if (emailExists) throw new AppError('EMAIL_TAKEN', 'Email already registered', 409);

  const passwordHash = await hashPassword(data.password);
  const user = await prisma.user.create({
    data: {
      accountType: 'REGISTERED',
      profile: {
        create: {
          displayName: data.displayName,
          username: data.username.toLowerCase(),
        },
      },
      identities: {
        create: {
          provider: 'EMAIL',
          email: data.email.toLowerCase(),
          passwordHash,
        },
      },
      entitlement: { create: { status: 'free' } },
      notificationPrefs: { create: {} },
    },
    include: { profile: true, entitlement: true },
  });

  const tokens = await createSession(user.id, ipAddress);
  return {
    user,
    profile: user.profile!,
    entitlement: user.entitlement!,
    tokens,
  };
}

export async function login(email: string, password: string, ipAddress?: string): Promise<AuthSessionDto> {
  const identity = await prisma.authIdentity.findFirst({
    where: { provider: 'EMAIL', email: email.toLowerCase() },
    include: { user: { include: { profile: true, entitlement: true } } },
  });
  if (!identity?.passwordHash) throw ERR.UNAUTHORIZED;
  const valid = await verifyPassword(password, identity.passwordHash);
  if (!valid) throw ERR.UNAUTHORIZED;
  if (identity.user.status === 'SUSPENDED') throw new AppError('ACCOUNT_SUSPENDED', 'Account suspended', 403);
  if (identity.user.status === 'DELETED') throw ERR.UNAUTHORIZED;

  const tokens = await createSession(identity.userId, ipAddress);
  await prisma.user.update({ where: { id: identity.userId }, data: { lastActiveAt: new Date() } });
  return {
    user: identity.user,
    profile: identity.user.profile!,
    entitlement: identity.user.entitlement ?? await prisma.entitlement.create({ data: { userId: identity.userId, status: 'free' } }),
    tokens,
  };
}

export async function createGuestSession(displayName?: string): Promise<AuthSessionDto> {
  const guestNum = randomUUID().slice(0, 8);
  const user = await prisma.user.create({
    data: {
      accountType: 'GUEST',
      profile: {
        create: {
          displayName: displayName ?? `Misafir ${guestNum}`,
          username: `guest_${guestNum}`,
        },
      },
      identities: { create: { provider: 'GUEST' } },
      entitlement: { create: { status: 'free' } },
      notificationPrefs: { create: {} },
    },
    include: { profile: true, entitlement: true },
  });
  const tokens = await createSession(user.id);
  return { user, profile: user.profile!, entitlement: user.entitlement!, tokens };
}

export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  const payload = verifyRefreshToken(refreshToken);
  const session = await prisma.userSession.findUnique({ where: { refreshToken } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) throw ERR.UNAUTHORIZED;

  await prisma.userSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
  return createSession(payload.sub);
}

export async function logout(refreshToken: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { refreshToken },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllSessions(userId: string): Promise<void> {
  await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getUserFromToken(accessToken: string): Promise<{ userId: string; user: User; profile: UserProfile }> {
  const payload = verifyAccessToken(accessToken);
  const session = await loadSession(payload.sub);
  return { userId: payload.sub, user: session.user, profile: session.profile };
}

export async function upgradeGuest(guestId: string, data: {
  email: string;
  password: string;
  displayName: string;
  username: string;
}): Promise<AuthSessionDto> {
  const guest = await prisma.user.findUnique({ where: { id: guestId } });
  if (!guest || guest.accountType !== 'GUEST') throw ERR.NOT_FOUND;

  const passwordHash = await hashPassword(data.password);
  await prisma.$transaction([
    prisma.user.update({ where: { id: guestId }, data: { accountType: 'GUEST_LINKED' } }),
    prisma.userProfile.update({
      where: { userId: guestId },
      data: { displayName: data.displayName, username: data.username.toLowerCase() },
    }),
    prisma.authIdentity.create({
      data: { userId: guestId, provider: 'EMAIL', email: data.email.toLowerCase(), passwordHash },
    }),
  ]);

  const session = await loadSession(guestId);
  const tokens = await createSession(guestId);
  return { ...session, tokens };
}

export async function signInWithProvider(provider: AuthProvider, providerToken: string, profile: { email?: string; displayName: string }): Promise<AuthSessionDto> {
  // Provider token validation would happen here in production
  const providerId = providerToken.slice(0, 64);
  let identity = await prisma.authIdentity.findFirst({
    where: { provider, providerId },
    include: { user: { include: { profile: true, entitlement: true } } },
  });

  if (identity) {
    const tokens = await createSession(identity.userId);
    return {
      user: identity.user,
      profile: identity.user.profile!,
      entitlement: identity.user.entitlement ?? await prisma.entitlement.create({ data: { userId: identity.userId, status: 'free' } }),
      tokens,
    };
  }

  const username = `user_${randomUUID().slice(0, 8)}`;
  const user = await prisma.user.create({
    data: {
      accountType: 'REGISTERED',
      profile: { create: { displayName: profile.displayName, username } },
      identities: { create: { provider, providerId, email: profile.email } },
      entitlement: { create: { status: 'free' } },
      notificationPrefs: { create: {} },
    },
    include: { profile: true, entitlement: true },
  });
  const tokens = await createSession(user.id);
  return { user, profile: user.profile!, entitlement: user.entitlement!, tokens };
}
