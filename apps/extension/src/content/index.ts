import { storage } from "@/shared/storage";
import { extensionApi } from "@/shared/api";
import {
  detectTtmPageState,
  runTtmPreset,
  resetTtmSession,
} from "./ttm-engine";
import { TtmPresetMessage, TtmRunReport } from "@/types";

const ACTIVE_RUN_KEY = "__ttm_active_run__";

let activePreset: TtmPresetMessage | null = null;
let loopTimer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let lastAuthCheckTime = 0;
const AUTH_CHECK_INTERVAL_MS = 180000; // เช็คทุกๆ 3 นาทีในลูป

function clearLoop() {
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
}

async function verifyUserStatusSafe() {
  const now = Date.now();
  if (now - lastAuthCheckTime < AUTH_CHECK_INTERVAL_MS) {
    return true; // ยังไม่ถึงรอบเช็ค
  }

  lastAuthCheckTime = now;
  try {
    const token = await storage.getToken();
    if (!token) return false;

    // เรียกใช้ API ข้าม domain ไม่ได้โดยตรงใน content script 
    // วิธีที่ชัวร์และรองรับ CORS คือพึ่ง Background หรือแค่ดึง token มาดูว่าหมดอายุไหม
    // ในที่นี้ส่งไปให้ background ยิง API แทน
    const response = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: "CHECK_AUTH_STATUS" }, resolve);
    });

    return !!(response && (response as any).ok);
  } catch {
    return false;
  }
}

async function getStoredRun() {
  const result = await chrome.storage.local.get(ACTIVE_RUN_KEY);
  return (result[ACTIVE_RUN_KEY] as { tabId?: number; preset?: TtmPresetMessage } | undefined) ?? null;
}

async function clearStoredRun() {
  await chrome.storage.local.remove(ACTIVE_RUN_KEY);
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

  // 1) เพิ่มตรวจสอบสิทธิ์ใน Heartbeat Loop กันสาย Bypass
  const isAuthValid = await verifyUserStatusSafe();
  if (!isAuthValid) {
    running = false;
    activePreset = null;
    clearLoop();
    await clearStoredRun();
    alert("❌ บัญชีของคุณหมดอายุ ถูกจำกัดจำนวนอุปกรณ์ หรือถูกระงับการใช้งาน");
    window.location.reload();
    return { stopped: true, action: "auth-failed" } as unknown as TtmRunReport;
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
      clearLoop();
      running = false;
      activePreset = null;
      await clearStoredRun();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message?.type === "RUN_PRESET") {
    void (async () => {
      // 2) บังคับเช็ค "ก่อนกดเริ่ม" อีกรอบ (กัน user bypass ไม่เปิด panel)
      const isAuthValid = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "CHECK_AUTH_STATUS" }, resolve);
      });

      if (!(isAuthValid as { ok: boolean })?.ok) {
        alert("⚠️ บัญชีของคุณไม่สามารถใช้งานได้ในขณะนี้");
        sendResponse({ ok: false, error: "Auth failed" });
        return;
      }

      resetTtmSession();
      activePreset = (message.payload ?? null) as TtmPresetMessage | null;
      clearLoop();
      // เซ็ตเวลาเริ่มต้นให้ไม่ต้องไปเช็คอีกใน 3 นาทีข้างหน้า
      lastAuthCheckTime = Date.now();
      const result = await executeRunCycle("manual");
      sendResponse({ ok: true, result });
    })();
    return true;
  }

  return false;
});

void bootstrapFromStorage();
