import { v4 as uuidv4 } from 'uuid';
import type { AuthApi, AuthSession, LoginDto, RecoverDto, RegisterDto } from '../contracts/auth.api';
import type { AuthIdentity, Entitlement, GuestSession, Profile, User } from '@/domain/models/user';
import { AUTH_PROVIDER, ENTITLEMENT_STATUS } from '@/domain/constants/enums';
import { MOCK_USER } from './data';
import { appStorage } from '@/services/storage';
import { STORAGE_KEYS } from '@/domain/constants/app';

const createProfile = (overrides: Partial<Profile> = {}): Profile => ({
  userId: MOCK_USER.id,
  displayName: MOCK_USER.name,
  username: MOCK_USER.username,
  avatarUrl: MOCK_USER.avatar,
  locale: 'tr',
  stats: {
    quizzesCreated: MOCK_USER.stats.quizzesCreated,
    quizzesCompleted: MOCK_USER.stats.quizzesCompleted,
    gamesPlayed: 0,
    averageScore: MOCK_USER.stats.averageScore,
    friendsCount: MOCK_USER.stats.friendsCount,
    badgesCount: MOCK_USER.stats.badgesCount,
  },
  ...overrides,
});

const createEntitlement = (userId: string, isPremium = MOCK_USER.isPremium): Entitlement => ({
  userId,
  status: isPremium ? ENTITLEMENT_STATUS.PREMIUM : ENTITLEMENT_STATUS.FREE,
  expiresAt: MOCK_USER.premiumExpiresAt,
  source: 'unknown',
  verifiedAt: isPremium ? new Date().toISOString() : undefined,
});

export const createMockAuthApi = (
  getAuthenticated: () => boolean,
  setAuthenticated: (v: boolean) => void,
): AuthApi => {
  let currentUser: User = {
    id: MOCK_USER.id,
    createdAt: MOCK_USER.createdAt,
    updatedAt: new Date().toISOString(),
    status: 'active',
    role: 'user',
  };
  let currentProfile = createProfile();

  const buildSession = (tokens: { accessToken: string; refreshToken: string }): AuthSession => ({
    user: currentUser,
    profile: currentProfile,
    identity: {
      id: uuidv4(),
      userId: currentUser.id,
      provider: AUTH_PROVIDER.USERNAME,
      isVerified: true,
      createdAt: currentUser.createdAt,
    },
    entitlement: createEntitlement(currentUser.id),
    tokens,
  });

  return {
    async login(data: LoginDto) {
      if (!data.username || !data.password) throw new Error('Kullanıcı adı ve şifre gerekli');
      setAuthenticated(true);
      return buildSession({ accessToken: 'mock-token', refreshToken: 'mock-refresh' });
    },
    async register(data: RegisterDto) {
      currentUser = { ...currentUser, id: uuidv4(), updatedAt: new Date().toISOString() };
      currentProfile = createProfile({ displayName: data.username, username: data.username.toLowerCase() });
      setAuthenticated(true);
      return { ...buildSession({ accessToken: 'mock-token', refreshToken: 'mock-refresh' }), recoveryCode: 'NKT-MOCK-CODE-0001' };
    },
    async recover(data: RecoverDto) {
      if (!data.username || !data.recoveryCode || !data.newPassword) throw new Error('Eksik recovery bilgisi');
      setAuthenticated(true);
      return { ...buildSession({ accessToken: 'mock-token', refreshToken: 'mock-refresh' }), recoveryCode: 'NKT-MOCK-CODE-0002' };
    },
    async logout() {
      setAuthenticated(false);
    },
    async refreshToken() {
      return { accessToken: 'mock-token', refreshToken: 'mock-refresh' };
    },
    async createGuestSession(displayName = 'Misafir') {
      const guestId = `guest-${uuidv4()}`;
      const session: GuestSession = {
        guestId,
        displayName,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      };
      await appStorage.setJSON(STORAGE_KEYS.guestSession, session);
      const profile = createProfile({ userId: guestId, displayName, username: `guest_${guestId.slice(-6)}` });
      return { session, profile };
    },
    async upgradeGuest(guestId, data) {
      currentUser = { id: uuidv4(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: 'active', role: 'user' };
      currentProfile = createProfile({ displayName: data.username, username: data.username });
      const identity: AuthIdentity = {
        id: uuidv4(),
        userId: currentUser.id,
        provider: AUTH_PROVIDER.USERNAME,
        isVerified: false,
        createdAt: new Date().toISOString(),
        upgradedFromGuestId: guestId,
      };
      setAuthenticated(true);
      return {
        user: currentUser,
        profile: currentProfile,
        identity,
        entitlement: createEntitlement(currentUser.id),
        tokens: { accessToken: 'mock-token', refreshToken: 'mock-refresh' },
      };
    },
    async getSession() {
      if (!getAuthenticated()) return null;
      return buildSession({ accessToken: 'mock-token', refreshToken: 'mock-refresh' });
    },
    async signInWithProvider(provider, _token) {
      setAuthenticated(true);
      const identity: AuthIdentity = {
        id: uuidv4(),
        userId: currentUser.id,
        provider,
        isVerified: true,
        createdAt: new Date().toISOString(),
      };
      return { ...buildSession({ accessToken: 'mock-token', refreshToken: 'mock-refresh' }), identity };
    },
  };
};
