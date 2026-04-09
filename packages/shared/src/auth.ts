import type { AppPermission, PlanType, SubscriptionStatus, UserRole } from "./constants";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  permissions: AppPermission[];
  subscription: {
    plan: PlanType;
    status: SubscriptionStatus;
    startsAt: string;
    expiresAt: string | null;
    maxDevices: number;
    activeDevices: number;
  } | null;
};

export type LoginRequest = {
  email: string;
  password?: string;
  deviceKey?: string;
  deviceName?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthResponse = AuthTokens & {
  user: AuthUser;
};

export type LoginResponse = AuthResponse;

export type MeResponse = {
  user: AuthUser;
};

export type RefreshTokenRequest = {
  refreshToken: string;
};

export type RefreshTokenResponse = AuthResponse;

export type SubscriptionSummary = {
  plan: PlanType;
  status: SubscriptionStatus;
  startsAt: string;
  expiresAt: string | null;
  maxDevices: number;
  activeDevices: number;
};
