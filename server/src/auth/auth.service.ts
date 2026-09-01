import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { config } from '../config/index.js';
import { prisma } from '../database/prisma.js';
import { AppError, ERR } from '../common/response.js';
import type { AuthProvider, AccountType, User, UserProfile, Entitlement } from '@prisma/client';
import {
  generateRecoveryCode,
  hashRecoveryCode,
  isAdult18,
  normalizeUsername,
  parseBirthDate,
  validatePassword,
  validateUsername,
} from './identity.js';

const SALT_ROUNDS = 12;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

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
  recoveryCode?: string;
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
  return jwt.sign(
    { sub: userId, type: 'refresh', jti: randomUUID() } satisfies TokenPayload & { jti: string },
    config.JWT_REFRESH_SECRET,
    opts,
  );
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
  username: string;
  password: string;
  birthDate: string;
}, ipAddress?: string): Promise<AuthSessionDto> {
  const normalizedUsername = validateUsername(data.username);
  validatePassword(data.password);
  const birthDate = parseBirthDate(data.birthDate);

  const existing = await prisma.userProfile.findFirst({
    where: { usernameNormalized: normalizedUsername },
  });
  if (existing) throw new AppError('USERNAME_TAKEN', 'Username already taken', 409);

  const passwordHash = await hashPassword(data.password);
  const recoveryCode = generateRecoveryCode();
  const recoveryCodeHash = hashRecoveryCode(recoveryCode);
  const user = await prisma.user.create({
    data: {
      accountType: 'REGISTERED',
      birthDate,
      ageVerified18: isAdult18(birthDate),
      profile: {
        create: {
          displayName: normalizedUsername,
          username: normalizedUsername,
          usernameNormalized: normalizedUsername,
        },
      },
      identities: {
        create: {
          provider: 'USERNAME',
          usernameNormalized: normalizedUsername,
          passwordHash,
          recoveryCodeHash,
          recoveryCodeUpdatedAt: new Date(),
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
    recoveryCode,
  };
}

export async function login(username: string, password: string, ipAddress?: string): Promise<AuthSessionDto> {
  const normalized = normalizeUsername(username);
  const key = `${ipAddress ?? 'unknown'}:${normalized}`;
  const current = loginAttempts.get(key);
  const now = Date.now();
  if (current && current.resetAt > now && current.count >= 10) {
    throw new AppError('RATE_LIMIT', 'Too many attempts', 429);
  }
  const identity = await prisma.authIdentity.findFirst({
    where: { provider: 'USERNAME', usernameNormalized: normalized },
    include: { user: { include: { profile: true, entitlement: true } } },
  });
  if (!identity?.passwordHash) {
    loginAttempts.set(key, { count: (current?.count ?? 0) + 1, resetAt: now + 60_000 });
    throw ERR.UNAUTHORIZED;
  }
  const valid = await verifyPassword(password, identity.passwordHash);
  if (!valid) {
    loginAttempts.set(key, { count: (current?.count ?? 0) + 1, resetAt: now + 60_000 });
    throw ERR.UNAUTHORIZED;
  }
  loginAttempts.delete(key);
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
          usernameNormalized: `guest_${guestNum}`,
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
  password: string;
  username: string;
  birthDate: string;
}): Promise<AuthSessionDto> {
  const guest = await prisma.user.findUnique({ where: { id: guestId } });
  if (!guest || guest.accountType !== 'GUEST') throw ERR.NOT_FOUND;

  const normalizedUsername = validateUsername(data.username);
  validatePassword(data.password);
  const birthDate = parseBirthDate(data.birthDate);

  const passwordHash = await hashPassword(data.password);
  const recoveryCode = generateRecoveryCode();
  await prisma.$transaction([
    prisma.user.update({
      where: { id: guestId },
      data: { accountType: 'GUEST_LINKED', birthDate, ageVerified18: isAdult18(birthDate) },
    }),
    prisma.userProfile.update({
      where: { userId: guestId },
      data: {
        displayName: normalizedUsername,
        username: normalizedUsername,
        usernameNormalized: normalizedUsername,
      },
    }),
    prisma.authIdentity.create({
      data: {
        userId: guestId,
        provider: 'USERNAME',
        usernameNormalized: normalizedUsername,
        passwordHash,
        recoveryCodeHash: hashRecoveryCode(recoveryCode),
        recoveryCodeUpdatedAt: new Date(),
      },
    }),
  ]);

  const session = await loadSession(guestId);
  const tokens = await createSession(guestId);
  return { ...session, tokens, recoveryCode };
}

const recoveryAttempts = new Map<string, { count: number; resetAt: number }>();

function assertRecoveryRateLimit(key: string): void {
  const now = Date.now();
  const current = recoveryAttempts.get(key);
  if (!current || current.resetAt < now) {
    recoveryAttempts.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (current.count >= 8) {
    throw new AppError('RATE_LIMIT', 'Too many recovery attempts', 429);
  }
  current.count += 1;
  recoveryAttempts.set(key, current);
}

export async function recoverPassword(
  data: { username: string; recoveryCode: string; newPassword: string },
  ipAddress?: string,
): Promise<AuthSessionDto> {
  const usernameNormalized = normalizeUsername(data.username);
  validatePassword(data.newPassword);
  assertRecoveryRateLimit(`${ipAddress ?? 'unknown'}:${usernameNormalized}`);

  const identity = await prisma.authIdentity.findFirst({
    where: { provider: 'USERNAME', usernameNormalized },
    include: { user: { include: { profile: true, entitlement: true } } },
  });
  if (!identity?.passwordHash || !identity.recoveryCodeHash) {
    throw new AppError('INVALID_RECOVERY', 'Invalid credentials', 401);
  }

  const providedHash = hashRecoveryCode(data.recoveryCode);
  if (providedHash !== identity.recoveryCodeHash) {
    throw new AppError('INVALID_RECOVERY', 'Invalid credentials', 401);
  }

  const passwordHash = await hashPassword(data.newPassword);
  const rotatedRecoveryCode = generateRecoveryCode();
  const rotatedRecoveryHash = hashRecoveryCode(rotatedRecoveryCode);
  await prisma.$transaction(async (tx) => {
    await tx.authIdentity.update({
      where: { id: identity.id },
      data: {
        passwordHash,
        recoveryCodeHash: rotatedRecoveryHash,
        recoveryCodeUpdatedAt: new Date(),
      },
    });
    await tx.userSession.updateMany({
      where: { userId: identity.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });

  const tokens = await createSession(identity.userId, ipAddress);
  return {
    user: identity.user,
    profile: identity.user.profile!,
    entitlement:
      identity.user.entitlement ??
      (await prisma.entitlement.create({ data: { userId: identity.userId, status: 'free' } })),
    tokens,
    recoveryCode: rotatedRecoveryCode,
  };
}

export async function signInWithProvider(
  provider: AuthProvider,
  providerToken: string,
  profile: { email?: string; displayName: string },
): Promise<AuthSessionDto> {
  void provider;
  void providerToken;
  void profile;
  throw new AppError('NOT_SUPPORTED', 'OAuth providers are disabled', 400);
}
