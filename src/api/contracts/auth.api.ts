import type { AuthIdentity, Entitlement, GuestSession, Profile, User } from '@/domain/models/user';
import type { AuthProvider } from '@/domain/constants/enums';

export interface LoginDto {
  username: string;
  password: string;
}

export interface RegisterDto {
  username: string;
  password: string;
  birthDate: string;
}

export interface RecoverDto {
  username: string;
  recoveryCode: string;
  newPassword: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession {
  user: User;
  profile: Profile;
  identity?: AuthIdentity;
  entitlement: Entitlement;
  tokens: AuthTokens;
  recoveryCode?: string;
}

export interface AuthApi {
  login(data: LoginDto): Promise<AuthSession>;
  register(data: RegisterDto): Promise<AuthSession>;
  recover(data: RecoverDto): Promise<AuthSession>;
  logout(): Promise<void>;
  refreshToken(refreshToken: string): Promise<AuthTokens>;
  createGuestSession(displayName?: string): Promise<{ session: GuestSession; profile: Profile }>;
  upgradeGuest(guestId: string, data: RegisterDto): Promise<AuthSession>;
  getSession(): Promise<AuthSession | null>;
  signInWithProvider(provider: AuthProvider, token: string): Promise<AuthSession>;
}
