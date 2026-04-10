import { storage } from "@/shared/storage";
import { extensionApi } from "@/shared/api";
import { StoredRun } from "@/types";
const ACTIVE_RUN_KEY = "__ttm_active_run__";


function isTtmUrl(url?: string) {
  return typeof url === "string" && url.startsWith("https://booking.thaiticketmajor.com/");
}

async function broadcastRunStatus(payload: Record<string, unknown>) {
  try {
    await chrome.runtime.sendMessage({ type: "TTM_RUN_STATUS", payload });
  } catch {
    // Side panel may not be open.
  }
}

async function setActionBadge(tabId: number, isRunning: boolean) {
  try {
    if (isRunning) {
      await chrome.action.setBadgeText({ text: "On", tabId });
      await chrome.action.setBadgeBackgroundColor({ color: "#22c55e", tabId });
    } else {
      await chrome.action.setBadgeText({ text: "", tabId });
    }
  } catch {
    // Tab might be invalid or closed
  }
}

async function getActiveRun() {
  const result = await chrome.storage.local.get(ACTIVE_RUN_KEY);
  return (result[ACTIVE_RUN_KEY] as StoredRun | undefined) ?? null;
}

async function setActiveRun(run: StoredRun) {
  await chrome.storage.local.set({ [ACTIVE_RUN_KEY]: run });
}

async function clearActiveRun() {
  await chrome.storage.local.remove(ACTIVE_RUN_KEY);
}

async function forceLogoutAndStop(tabId: number, detail: string) {
  const refreshToken = await storage.getRefreshToken();

  if (refreshToken) {
    await extensionApi.logout(refreshToken).catch(() => null);
  }

  await storage.clearSession();
  await clearActiveRun();
  await setActionBadge(tabId, false);

  await broadcastRunStatus({
    tabId,
    reason: "forced-logout",
    running: false,
    result: {
      step: "STOP",
      detail,
      state: "unknown",
      stopped: true,
      logs: ["ระบบออกจากระบบอัตโนมัติ"]
    }
  });

  try {
    await chrome.runtime.sendMessage({
      type: "SESSION_LOGGED_OUT",
      payload: {
        reason: detail
      }
    });
  } catch {
    // Side panel may be closed.
  }
}

async function notifySessionLoggedOut(reason: string) {
  try {
    await chrome.runtime.sendMessage({
      type: "SESSION_LOGGED_OUT",
      payload: {
        reason
      }
    });
  } catch {
    // Side panel may be closed.
  }
}

function getContentScriptFiles() {
  return chrome.runtime.getManifest().content_scripts?.[0]?.js ?? [];
}

async function ensureContentScript(tabId: number) {
  const files = getContentScriptFiles();

  if (!files.length) {
    return false;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files
  });

  return true;
}

async function hasContentResponder(tabId: number) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "PING_TTM_HELPER" });
    return Boolean(response?.ok);
  } catch {
    return false;
  }
}

async function dispatchRunToTab(tabId: number, preset: Record<string, unknown>, reason: string) {
  try {
    if (!(await hasContentResponder(tabId))) {
      const injected = await ensureContentScript(tabId);

      if (!injected) {
        throw new Error("ไม่มี content script แทรกอยู่ในหน้านี้ได้");
      }

      await new Promise((resolve) => setTimeout(resolve, 80));
    }

    const response = await chrome.tabs.sendMessage(tabId, {
      type: "RUN_PRESET",
      payload: preset
    });
    const result = response?.result as
      | {
        action?: string;
        detail?: string;
        step?: string;
        state?: string;
        stopped?: boolean;
        logs?: string[];
      }
      | undefined;

    await broadcastRunStatus({
      tabId,
      reason,
      running: !result?.stopped,
      result
    });

    if (result?.stopped) {
      await clearActiveRun();
      await setActionBadge(tabId, false);
    }

    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to dispatch run";

    await broadcastRunStatus({
      tabId,
      reason,
      running: false,
      error: message
    });

    await setActionBadge(tabId, false);

    return { ok: false, message };
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "CHECK_AUTH_STATUS") {
    // ให้ Background ยิงเช็ค API เสมอเพื่อเลี่ยง CORS จาก content script (หน้าเว็บ TTM)
    void (async () => {
      try {
        const token = await storage.getToken();
        if (!token) {
          sendResponse({ ok: false, error: "No token" });
          return;
        }
        await extensionApi.getCurrentUser(token);
        sendResponse({ ok: true });
      } catch (err) {
        await storage.clearSession();
        await notifySessionLoggedOut("เซสชันหมดอายุหรือบัญชีใช้งานไม่ได้ ระบบออกจากระบบแล้ว");
        sendResponse({ ok: false, error: err instanceof Error ? err.message : "Auth failed" });
      }
    })();
    return true;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Ticket Helper installed");
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => null);
});

chrome.runtime.onStartup?.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => null);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) {
    return;
  }

  chrome.sidePanel
    .setOptions({
      tabId,
      path: "src/sidepanel/index.html",
      enabled: isTtmUrl(tab.url)
    })
    .catch(() => null);

  // ดึงสถานะป้าย On กลับมา หากตรวจพบว่าหน้าเว็บมีการรีเฟรชหรือเปลี่ยนหน้าแต่บอทยังทำงานอยู่
  void (async () => {
    const run = await getActiveRun();
    if (run?.tabId === tabId) {
      await setActionBadge(tabId, true);
    }
  })();
});

// ฟังการส่งข้อมูลจาก content script (หน้าเว็บ TTM) เพื่อปิดป้าย On ตอนทำงานเสร็จหรือออโต้หยุด
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "TTM_RUN_STATUS" && sender.tab?.id) {
    if (message.payload?.running === false) {
      void setActionBadge(sender.tab.id, false);
    } else if (message.payload?.running === true) {
      // บังคับติดป้าย On ตลอดเวลาที่บอทยังทำงานอยู่ กัน Chrome แอบลบทิ้งช่วงโหลดหน้าเว็บ
      void setActionBadge(sender.tab.id, true);
    }
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  void (async () => {
    const run = await getActiveRun();

    if (run?.tabId === tabId) {
      await clearActiveRun();
    }
  })();
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "AUTH_STATUS") {
    void (async () => {
      const token = await storage.getToken();

      if (!token) {
        sendResponse({ authenticated: false });
        return;
      }

      try {
        const response = await extensionApi.getCurrentUser(token);
        sendResponse({ authenticated: true, user: response.user });
      } catch {
        await storage.clearSession();
        await notifySessionLoggedOut("เซสชันหมดอายุหรือบัญชีใช้งานไม่ได้ ระบบออกจากระบบแล้ว");
        sendResponse({ authenticated: false });
      }
    })();

    return true;
  }

  if (message?.type === "REFRESH_SESSION") {
    void (async () => {
      const refreshToken = await storage.getRefreshToken();

      if (!refreshToken) {
        sendResponse({ ok: false });
        return;
      }

      try {
        const refreshed = await extensionApi.refresh(refreshToken);
        await storage.setSession(
          refreshed.accessToken,
          refreshed.refreshToken,
          refreshed.user
        );
        sendResponse({ ok: true, payload: refreshed });
      } catch {
        await storage.clearSession();
        await notifySessionLoggedOut("เซสชันหมดอายุหรือบัญชีใช้งานไม่ได้ ระบบออกจากระบบแล้ว");
        sendResponse({ ok: false });
      }
    })();

    return true;
  }

  if (message?.type === "START_TTM_RUN") {
    void (async () => {
      const tabId = Number(message.tabId);

      if (!Number.isFinite(tabId) || tabId <= 0) {
        sendResponse({ ok: false, message: "Invalid tab" });
        return;
      }

      await setActionBadge(tabId, true);

      const preset = (message.payload ?? {}) as Record<string, unknown>;

      await setActiveRun({
        tabId,
        preset,
        startedAt: Date.now()
      });

      await broadcastRunStatus({
        tabId,
        reason: "manual-start",
        running: true,
        result: {
          step: "A",
          detail: "กำลังเริ่มทำงานบน TTM แล้ว",
          state: "unknown"
        }
      });

      const result = await dispatchRunToTab(tabId, preset, "manual-start");
      sendResponse(result);
    })();

    return true;
  }

  if (message?.type === "STOP_TTM_RUN") {
    void (async () => {
      const tabId = Number(message.tabId);

      await clearActiveRun();
      await setActionBadge(tabId, false);

      try {
        await chrome.tabs.sendMessage(tabId, { type: "STOP_TTM_RUN" });
      } catch {
        // Content script may not be attached anymore.
      }

      await broadcastRunStatus({
        tabId,
        reason: "manual-stop",
        running: false,
        result: {
          step: "STOP",
          detail: "หยุดการทำงานเรียบร้อย",
          state: "unknown",
          stopped: true
        }
      });

      sendResponse({ ok: true });
    })();

    return true;
  }

  if (message?.type === "FORCE_LOGOUT_AND_STOP") {
    void (async () => {
      const tabId = Number(_sender?.tab?.id ?? message.tabId);
      await forceLogoutAndStop(
        Number.isFinite(tabId) ? tabId : -1,
        String(message.detail ?? "บัญชีของคุณไม่สามารถใช้งานได้ในขณะนี้ ระบบออกจากระบบและหยุดบอทแล้ว")
      );

      if (Number.isFinite(tabId) && tabId > 0) {
        try {
          await chrome.tabs.sendMessage(tabId, { type: "STOP_TTM_RUN" });
        } catch {
          // Content script may already be unloading.
        }
      }

      sendResponse({ ok: true });
    })();

    return true;
  }

  if (message?.type === "GET_TTM_RUN_STATUS") {
    void (async () => {
      const tabId = Number(message.tabId);
      const run = await getActiveRun();
      sendResponse({ ok: true, running: run?.tabId === tabId });
    })();

    return true;
  }

  return false;
});
