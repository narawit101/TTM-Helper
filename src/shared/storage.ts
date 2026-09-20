function readLocalValue<T>(key: string): T | null {
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

function writeLocalValue<T>(key: string, value: T): void {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }

    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore localStorage failures
  }
}

function removeLocalValue(key: string): void {
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
  async getDraft<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return (result[key] as T | undefined) ?? readLocalValue<T>(key) ?? null;
  },
  async setDraft<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({
      [key]: value
    });
    writeLocalValue(key, value);
  },
  async clearDraft(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
    removeLocalValue(key);
  }
};
