import type { AuthUser } from "./auth";
import type { PlanType, SubscriptionStatus } from "./constants";

export type UserSummary = AuthUser & {
  createdAt?: string;
  lastLoginAt?: string | null;
  isActive?: boolean;
};

export type ManagedUserCreateRequest = {
  email: string;
  name?: string;
  startsAt?: string | null;
  expiresAt?: string | null;
  maxDevices?: number;
  plan: PlanType;
};

export type ManagedUserUpdateRequest = {
  email?: string;
  name?: string | null;
  isActive?: boolean;
  plan?: PlanType;
  status?: SubscriptionStatus;
  startsAt?: string | null;
  expiresAt?: string | null;
  maxDevices?: number;
  applyPlanDefaults?: boolean;
};
