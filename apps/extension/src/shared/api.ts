import type {
  AuthResponse,
  LoginRequest,
  MeResponse,
  TicketPresetRecord
} from "@ticket-helper/shared";
import { storage } from "./storage";

declare const __API_URL__: string;

const API_URL = __API_URL__;

export const authEvents = new EventTarget();

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      await storage.clearSession();
      authEvents.dispatchEvent(new Event("session-expired"));
    }

    const payload = (await response.json().catch(() => null)) as
      | { message?: string }
      | null;
    throw new Error(payload?.message ?? "Request failed");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const extensionApi = {
  login(payload: LoginRequest) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  refresh(refreshToken: string) {
    return request<AuthResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },
  logout(refreshToken: string) {
    return request<void>("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken })
    });
  },
  getCurrentUser(token: string) {
    return request<MeResponse>("/auth/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  getMySubscription(token: string) {
    return request<{ subscription: unknown }>("/subscriptions/me", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  },
  createPreset(token: string, payload: Record<string, unknown>) {
    return request<{ preset: TicketPresetRecord }>("/presets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
  },
  getPresets(token: string) {
    return request<{ presets: TicketPresetRecord[] }>("/presets", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  }
};
