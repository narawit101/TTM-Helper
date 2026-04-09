import type { PlanType } from "./constants";

export type PlanSettingSummary = {
  id: string;
  plan: PlanType;
  durationDays: number;
  maxDevices: number;
  createdAt: string;
  updatedAt: string;
};

export type PlanSettingsResponse = {
  settings: PlanSettingSummary[];
};

export type PlanSettingUpdateRequest = {
  durationDays?: number;
  maxDevices?: number;
};
