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

async function forceStopRun(tabId: number, detail: string) {
  await clearActiveRun();
  if (tabId > 0) {
    await setActionBadge(tabId, false);
  }

  await broadcastRunStatus({
    tabId,
    reason: "forced-stop",
    running: false,
    result: {
      step: "STOP",
      detail,
      state: "unknown",
      stopped: true,
      logs: [detail]
    }
  });
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

chrome.runtime.onInstalled.addListener(() => {
  console.log("Ticket Helper installed");
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => null);
  // Keepalive alarm to prevent SW from sleeping
  chrome.alarms.create("sw-keepalive", { periodInMinutes: 0.33 });
});

chrome.runtime.onStartup?.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => null);
  chrome.alarms.create("sw-keepalive", { periodInMinutes: 0.33 });
});

// Re-register behavior whenever SW awakens
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => null);

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sw-keepalive") {
    // no-op: just keep SW awake
  }
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

  void (async () => {
    const run = await getActiveRun();
    if (run?.tabId === tabId) {
      await setActionBadge(tabId, true);
    }
  })();
});

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type === "TTM_RUN_STATUS" && sender.tab?.id) {
    if (message.payload?.running === false) {
      void setActionBadge(sender.tab.id, false);
    } else if (message.payload?.running === true) {
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

  if (message?.type === "FORCE_STOP_RUN" || message?.type === "FORCE_LOGOUT_AND_STOP") {
    void (async () => {
      const tabId = Number(_sender?.tab?.id ?? message.tabId);
      await forceStopRun(
        Number.isFinite(tabId) ? tabId : -1,
        String(message.detail ?? "การทำงานถูกหยุดโดยระบบ")
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
