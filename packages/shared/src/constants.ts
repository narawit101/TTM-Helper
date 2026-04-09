export const USER_ROLES = ["ADMIN", "MEMBER"] as const;
export const PLAN_TYPES = ["STANDARD", "MEDIUM", "PRO", "VIP"] as const;
export const SUBSCRIPTION_STATUSES = ["ACTIVE", "SUSPENDED", "EXPIRED"] as const;
export const APP_PERMISSIONS = [
  "users.read",
  "users.write",
  "subscriptions.read",
  "subscriptions.write",
  "presets.read",
  "presets.write",
  "extension.use",
  "admin.access"
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type PlanType = (typeof PLAN_TYPES)[number];
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type AppPermission = (typeof APP_PERMISSIONS)[number];
