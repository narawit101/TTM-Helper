import type { AuthUser } from "@ticket-helper/shared";

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const USER_KEY = "auth_user";
const DEVICE_KEY = "device_key";
const DEVICE_NAME_KEY = "device_name";

function readLocalValue<T>(key: string) {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }

    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocalValue<T>(key: string, value: T) {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage failures
  }
}

function removeLocalValue(key: string) {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }

    localStorage.removeItem(key);
  } catch {
    // ignore localStorage failures
  }
}

export const storage = {
  async getOrCreateDeviceIdentity() {
    const result = await chrome.storage.local.get([DEVICE_KEY, DEVICE_NAME_KEY]);
    let deviceKey = (result[DEVICE_KEY] as string | undefined) ?? null;
    let deviceName = (result[DEVICE_NAME_KEY] as string | undefined) ?? null;

    if (!deviceKey) {
      deviceKey =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `device-${Math.random().toString(36).slice(2)}-${Date.now()}`;
    }

    if (!deviceName) {
      const platform =
        typeof navigator !== "undefined" && navigator.platform
          ? navigator.platform
          : "Chrome Extension";
      deviceName = `Extension ${platform}`;
    }

    await chrome.storage.local.set({
      [DEVICE_KEY]: deviceKey,
      [DEVICE_NAME_KEY]: deviceName
    });

    return { deviceKey, deviceName };
  },
  async getToken() {
    const result = await chrome.storage.local.get(ACCESS_TOKEN_KEY);
    return (result[ACCESS_TOKEN_KEY] as string | undefined) ?? null;
  },
  async getUser() {
    const result = await chrome.storage.local.get(USER_KEY);
    return (result[USER_KEY] as AuthUser | undefined) ?? null;
  },
  async getRefreshToken() {
    const result = await chrome.storage.local.get(REFRESH_TOKEN_KEY);
    return (result[REFRESH_TOKEN_KEY] as string | undefined) ?? null;
  },
  async setSession(token: string, refreshToken: string, user: AuthUser) {
    await chrome.storage.local.set({
      [ACCESS_TOKEN_KEY]: token,
      [REFRESH_TOKEN_KEY]: refreshToken,
      [USER_KEY]: user
    });
  },
  async clearSession() {
    await chrome.storage.local.remove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY]);
    removeLocalValue(ACCESS_TOKEN_KEY);
    removeLocalValue(REFRESH_TOKEN_KEY);
    removeLocalValue(USER_KEY);
  },
  async getDraft<T>(key: string) {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? readLocalValue<T>(key) ?? null;
  },
  async setDraft<T>(key: string, value: T) {
    await chrome.storage.local.set({
      [key]: value
    });
    writeLocalValue(key, value);
  },
  async clearDraft(key: string) {
    await chrome.storage.local.remove(key);
    removeLocalValue(key);
  }
};
