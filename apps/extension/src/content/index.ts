import { storage } from "@/shared/storage";
import {
  detectTtmPageState,
  runTtmPreset,
  resetTtmSession
} from "./ttm-engine";
import { TtmPresetMessage, TtmRunReport } from "@/types";

const ACTIVE_RUN_KEY = "__ttm_active_run__";
const PAGE_ALERT_EVENT = "__ttm_helper_page_alert__";
const ACCOUNT_BLOCKED_MESSAGE = "บัญชีของคุณไม่สามารถใช้งานได้ในขณะนี้";

let activePreset: TtmPresetMessage | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let pageAlertListenerInstalled = false;

function clearLoop() {
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}

async function getStoredRun() {
  const result = await chrome.storage.local.get(ACTIVE_RUN_KEY);
  return (result[ACTIVE_RUN_KEY] as { tabId?: number; preset?: TtmPresetMessage } | undefined) ?? null;
}

async function clearStoredRun() {
  await chrome.storage.local.remove(ACTIVE_RUN_KEY);
}

function injectPageAlertBridge() {
  if (document.documentElement.dataset.ttmHelperAlertBridge === "true") {
    return;
  }

  const script = document.createElement("script");
  script.textContent = `
    (() => {
      if (window.__ttmHelperAlertBridgeInstalled) return;
      window.__ttmHelperAlertBridgeInstalled = true;
      const originalAlert = window.alert.bind(window);
      window.alert = function(message) {
        try {
          window.dispatchEvent(new CustomEvent("${PAGE_ALERT_EVENT}", {
            detail: String(message ?? "")
          }));
        } catch {}
        return originalAlert(message);
      };
    })();
  `;

  (document.head ?? document.documentElement).appendChild(script);
  script.remove();
  document.documentElement.dataset.ttmHelperAlertBridge = "true";
}

async function stopRunLocally() {
  clearLoop();
  running = false;
  activePreset = null;
  await clearStoredRun();
  resetTtmSession();
}

async function forceLogoutAndStop(detail: string) {
  await stopRunLocally();

  try {
    await chrome.runtime.sendMessage({
      type: "FORCE_LOGOUT_AND_STOP",
      detail
    });
  } catch {
    // Ignore runtime disconnects during refresh or page unload.
  }
}

function installPageAlertListener() {
  if (pageAlertListenerInstalled) {
    return;
  }

  window.addEventListener(PAGE_ALERT_EVENT, (event: Event) => {
    const message = event instanceof CustomEvent ? String(event.detail ?? "") : "";

    if (!message.includes(ACCOUNT_BLOCKED_MESSAGE)) {
      return;
    }

    void forceLogoutAndStop(`${ACCOUNT_BLOCKED_MESSAGE} || ${message}`);
  });

  pageAlertListenerInstalled = true;
}

async function broadcastResult(result: TtmRunReport, isRunning: boolean) {
  try {
    await chrome.runtime.sendMessage({
      type: "TTM_RUN_STATUS",
      payload: {
        running: isRunning,
        result
      }
    });
  } catch {
    // Side panel may not be open.
  }
}

function getModeDelays(runMode?: TtmPresetMessage["runMode"]) {
  switch (runMode) {
    case "FAST":
      return {
        zone: 140,
        zoneMissing: 900,
        fallback: 8,
        seat: 12,
        modalDismissed: Math.floor(Math.random() * (1000 - 500 + 1)) + 500, // 500-1000ms
        details: 25,
        queue: 80,
        default: 15
      };
    case "SAFE":
      return {
        zone: 1100,
        zoneMissing: 2600,
        fallback: 220,
        seat: 180,
        modalDismissed: Math.floor(Math.random() * (2000 - 1500 + 1)) + 1500, // 1500-2000ms
        details: 220,
        queue: 700,
        default: 240
      };
    default:
      return {
        zone: 320,
        zoneMissing: 1800,
        fallback: 50,
        seat: 40,
        modalDismissed: Math.floor(Math.random() * (1500 - 800 + 1)) + 800, // 800-1500ms
        details: 50,
        queue: 200,
        default: 35
      };
  }
}

function getNextDelay(result: TtmRunReport) {
  const delays = getModeDelays(activePreset?.runMode);

  switch (result.action) {
    case "zone-clicked":
    case "zone-waiting":
      return delays.zone;
    case "zone-missing":
      return delays.zoneMissing;
    case "seat-zone-fallback":
      return delays.fallback;
    case "seat-confirmed":
    case "seat-selected":
    case "seat-waiting":
      return delays.seat;
    case "seat-warning-modal-closed":
      return delays.modalDismissed;
    case "details-filled":
      return delays.details;
    case "queue-detected":
      return delays.queue;
    default:
      return delays.default;
  }
}

async function executeRunCycle(reason: string) {
  if (!activePreset) {
    const storedRun = await getStoredRun();
    activePreset = storedRun?.preset ?? null;
  }

  if (!activePreset) {
    running = false;
    return null;
  }

  running = true;
  const result = runTtmPreset(activePreset);
  await broadcastResult(result, !result.stopped);

  if (result.stopped) {
    running = false;
    activePreset = null;
    clearLoop();
    await clearStoredRun();
    return result;
  }

  clearLoop();
  loopTimer = setTimeout(() => {
    void executeRunCycle(`follow-up:${reason}`);
  }, getNextDelay(result));

  return result;
}

async function bootstrapFromStorage() {
  injectPageAlertBridge();
  installPageAlertListener();

  const storedRun = await getStoredRun();

  if (!storedRun?.preset || !window.location.href.startsWith("https://booking.thaiticketmajor.com/")) {
    return;
  }

  activePreset = storedRun.preset;
  clearLoop();
  void executeRunCycle("bootstrap");
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "PING_TTM_HELPER") {
    sendResponse({ ok: true, state: detectTtmPageState(), running });
    return true;
  }

  if (message?.type === "GET_TTM_STATE") {
    sendResponse({ ok: true, result: { state: detectTtmPageState() } });
    return true;
  }

  if (message?.type === "STOP_TTM_RUN") {
    void (async () => {
      await stopRunLocally();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "RUN_PRESET") {
    void (async () => {
      injectPageAlertBridge();
      installPageAlertListener();

      resetTtmSession();
      activePreset = (message.payload ?? null) as TtmPresetMessage | null;
      clearLoop();
      const result = await executeRunCycle("manual");
      sendResponse({ ok: true, result });
    })();
    return true;
  }

  return false;
});

void bootstrapFromStorage();
