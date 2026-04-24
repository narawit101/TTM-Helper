import type { FormEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "@ticket-helper/shared";
import { extensionApi, authEvents } from "@/shared/api";
import { storage } from "@/shared/storage";
import { APP_CONFIG } from "@/shared/config";
import { SectionKey, HelperDraft } from "@/types";
import { formatDateThai } from "@/util/formatDate";

function getCurrentStartTime() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function createDefaultDraft(): HelperDraft {
  return {
    url: "",
    round: "",
    zones: "",
    price: "",
    ticket: "",
    seat_type: "adjacent",
    runMode: "FAST",
    start_time: getCurrentStartTime(),
    delivery: "pickup",
    payment: "qr",
    names: ["", ""],
    code_1: "",
    code_2: "",
    code_3: "",
    code_4: "",
    phone_number: "",
    enable_proxy: false
  };
}

const defaultDraft: HelperDraft = createDefaultDraft();

const SEAT_RULE_OPTIONS = [
  { value: "front-left", label: "เลือกจากแถวแรกก่อน (ซ้าย)" },
  { value: "front-right", label: "เลือกจากแถวแรกก่อน (ขวา)" },
  // { value: "back-left", label: "เลือกจากแถวหลังๆก่อน (ซ้าย)" },
  // { value: "back-right", label: "เลือกจากแถวหลังๆก่อน (ขวา)" },
  { value: "random", label: "เลือกแบบสุ่มที่นั่ง" },
  { value: "adjacent", label: "เลือกที่นั่งติดกัน" },
  { value: "middle", label: "เลือกตรงกลาง" }
] as const;

const UI_SECTION_TITLES: Record<SectionKey, string> = {
  concert: "รายละเอียดคอนเสิร์ต",
  names: "ชื่อบนบัตร",
  citizens: "เลขเมมเบอร์/บัตรประชาชน",
  payment: "วิธีการชำระเงิน"
};

function classNames(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function toUserStatus(message: string, isRunning: boolean) {
  const clean = String(message ?? "").replace(/^\[[^\]]+\]\s*/, "").trim();

  if (!clean) {
    return isRunning ? "กำลังทำงานอยู่" : "พร้อมเริ่มทำงาน";
  }

  if (clean.includes("payment") || clean.includes("ชำระเงิน")) {
    return "ถึงหน้าชำระเงินแล้ว";
  }

  if (clean.includes("seat") || clean.includes("ที่นั่ง")) {
    return "กำลังเลือกที่นั่ง";
  }

  if (clean.includes("zone") || clean.includes("โซน")) {
    return "กำลังเลือกโซน";
  }

  if (clean.includes("หยุด")) {
    return "หยุดการทำงานแล้ว";
  }

  return clean;
}

function appendLogEntries(current: string[], next: string[]) {
  if (!next.length) {
    return current;
  }

  const merged = [...current];

  for (const line of next) {
    const text = String(line ?? "").trimEnd();

    if (!text) {
      continue;
    }

    if (merged[merged.length - 1] !== text) {
      merged.push(text);
    }
  }

  return merged.slice(-300);
}

function normalizeDraft(savedDraft?: Partial<HelperDraft> | null): HelperDraft {
  const baseDraft = createDefaultDraft();

  if (!savedDraft) {
    return baseDraft;
  }

  const merged = {
    ...baseDraft,
    ...savedDraft,
    round:
      savedDraft.round === undefined || savedDraft.round === null
        ? baseDraft.round
        : String(savedDraft.round),
    ticket:
      savedDraft.ticket === undefined || savedDraft.ticket === null
        ? baseDraft.ticket
        : String(savedDraft.ticket),
    seat_type:
      savedDraft.seat_type === "sequence"
        ? "back-right"
        : savedDraft.seat_type === "sequence-left"
          ? "front-left"
          : savedDraft.seat_type === "near"
            ? "adjacent"
            : savedDraft.seat_type ?? baseDraft.seat_type,
    start_time: savedDraft.start_time?.trim() ? savedDraft.start_time : baseDraft.start_time
  };
  return merged;
}

function isTtmBookingUrl(url?: string) {
  return typeof url === "string" && url.startsWith("https://booking.thaiticketmajor.com/");
}

function sanitizeConcertUrl(url?: string) {
  const value = String(url ?? "").trim();

  if (!value) {
    return "";
  }

  try {
    const parsed = new URL(value);
    return parsed.origin === "https://booking.thaiticketmajor.com" &&
      parsed.pathname.startsWith("/booking/")
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
}

function validateDraft(draft: HelperDraft) {
  const sanitizedUrl = sanitizeConcertUrl(draft.url);

  if (draft.url.trim() && !sanitizedUrl) {
    return { ok: false as const, field: "url", message: "กรุณากรอกลิงก์คอนเสิร์ตที่เป็นหน้า booking ให้ถูกต้อง" };
  }

  if (!draft.round.trim()) {
    return { ok: false as const, field: "round", message: "กรุณากรอกรอบ" };
  }

  if (!draft.zones.trim()) {
    return { ok: false as const, field: "zones", message: "กรุณากรอกโซน" };
  }

  if (!draft.ticket.trim() || !Number.isFinite(Number(draft.ticket)) || Number(draft.ticket) <= 0) {
    return { ok: false as const, field: "ticket", message: "กรุณากรอกจำนวนบัตรที่ต้องการ" };
  }

  return { ok: true as const, sanitizedUrl: sanitizedUrl || null };
}

async function reloadTabAndWait(tabId: number) {
  await chrome.tabs.reload(tabId);

  await new Promise<void>((resolve) => {
    const listener = (
      updatedTabId: number,
      changeInfo: chrome.tabs.TabChangeInfo
    ) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

export function SidePanelApp() {
  const [email, setEmail] = useState("");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [draft, setDraft] = useState<HelperDraft>(defaultDraft);
  const [message, setMessage] = useState("อย่าลืมล็อกอินเว็บไว้ก่อนเริ่มทำงาน");
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftReady, setDraftReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [blockedAccount, setBlockedAccount] = useState<{ email: string; reason: string; at: number } | null>(null);
  const debugLogRef = useRef<HTMLDivElement | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey | null>(null);

  useEffect(() => {
    async function boot() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const [storedToken, storedRefreshToken, storedUser, savedDraft] = await Promise.all([
        storage.getToken(),
        storage.getRefreshToken(),
        storage.getUser(),
        storage.getDraft<HelperDraft>("helper_draft")
      ]);

      if (tab?.id) {
        setActiveTabId(tab.id);
        const status = await chrome.runtime.sendMessage({
          type: "GET_TTM_RUN_STATUS",
          tabId: tab.id
        });
        setIsRunning(Boolean(status?.running));
      }

      if (storedToken && storedUser) {
        try {
          // Verify on boot to catch newly banned/expired users instantly
          await extensionApi.getCurrentUser(storedToken);
          setToken(storedToken);
          setRefreshToken(storedRefreshToken);
          setUser(storedUser);
        } catch {
          await storage.clearSession();
          setToken(null);
          setRefreshToken(null);
          setUser(null);
        }
      }

      setDraft(normalizeDraft(savedDraft));
      setDraftReady(true);

      setLoading(false);
    }

    void boot();
  }, []);

  // Listen for global session expiration events (e.g. from API interceptor)
  useEffect(() => {
    const handleSessionExpired = () => {
      setToken(null);
      setRefreshToken(null);
      setUser(null);
    };

    authEvents.addEventListener("session-expired", handleSessionExpired);
    return () => {
      authEvents.removeEventListener("session-expired", handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    const listener = (message: {
      type?: string;
      payload?: {
        tabId?: number;
        running?: boolean;
        error?: string;
        result?: { detail?: string; step?: string; logs?: string[] };
        reason?: string;
      };
    }) => {
      if (message?.type === "SESSION_LOGGED_OUT") {
        void storage.clearSession();
        setToken(null);
        setRefreshToken(null);
        setUser(null);
        setIsRunning(false);
        setMessage(message.payload?.reason ?? "ระบบออกจากระบบอัตโนมัติแล้ว");
        setDebugLogs((current) =>
          appendLogEntries(current, [
            `[STOP] ${message.payload?.reason ?? "ระบบออกจากระบบอัตโนมัติแล้ว"}`
          ])
        );
        return;
      }

      if (message?.type !== "TTM_RUN_STATUS") {
        return;
      }

      const payload = message.payload;

      if (!payload) {
        return;
      }

      if (activeTabId && payload.tabId && payload.tabId !== activeTabId) {
        return;
      }

      setIsRunning(Boolean(payload.running));

      if (payload.error) {
        setMessage(payload.error);
        setDebugLogs((current) =>
          appendLogEntries(current, [`ERROR: ${String(payload.error)}`])
        );
        return;
      }

      const result = payload.result;

      if (result?.detail) {
        const prefix = result.step ? `[${result.step}] ` : "";
        setMessage(`${prefix}${result.detail}`);
        setDebugLogs((current) =>
          appendLogEntries(current, [
            `${prefix}${result.detail}`
          ])
        );
      }
    };

    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, [activeTabId]);

  useEffect(() => {
    if (!draftReady) {
      return;
    }

    void storage.setDraft("helper_draft", draft);
  }, [draft, draftReady]);

  useEffect(() => {
    const node = debugLogRef.current;

    if (!node) {
      return;
    }

    node.scrollTop = node.scrollHeight;
  }, [debugLogs]);

  async function persistSession(payload: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
  }) {
    await storage.setSession(payload.accessToken, payload.refreshToken, payload.user);
    setToken(payload.accessToken);
    setRefreshToken(payload.refreshToken);
    setUser(payload.user);
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const device = await storage.getOrCreateDeviceIdentity();
      const payload = await extensionApi.login({
        email,
        deviceKey: device.deviceKey,
        deviceName: device.deviceName
      });
      await persistSession(payload);
      setMessage("เข้าสู่ระบบสำเร็จ");
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.toLowerCase().includes("failed to fetch")) {
          setMessage("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ (กรุณาเช็คอินเทอร์เน็ตหรือเซิร์ฟเวอร์อาจล่ม)");
        } else if (error.message.toLowerCase().includes("not found") || error.message.toLowerCase().includes("invalid")) {
          setMessage("อีเมลไม่ถูกต้อง หรือไม่มีในระบบ");
        } else if (error.message.toLowerCase().includes("account has expired")) {
          setMessage("บัญชีนี้หมดอายุการใช้งานแล้ว");
        }
        else {
          setMessage(`เกิดข้อผิดพลาด: ${error.message}`);
        }
      } else {
        setMessage("เข้าสู่ระบบไม่สำเร็จ (ข้อผิดพลาดไม่ทราบสาเหตุ)");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function withFreshToken<T>(task: (accessToken: string) => Promise<T>) {
    if (!token) {
      throw new Error("ยังไม่ได้เข้าสู่ระบบ");
    }

    try {
      return await task(token);
    } catch (error) {
      if (!refreshToken) {
        throw error;
      }

      const refreshed = await extensionApi.refresh(refreshToken);
      await persistSession(refreshed);
      return task(refreshed.accessToken);
    }
  }

  async function runHelper() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      setIsRunning(false);
      setMessage("กรุณาเปิดหน้า TTM ก่อน");
      return;
    }

    if (!isTtmBookingUrl(tab.url)) {
      setIsRunning(false);
      setMessage("กรุณาเปิดหน้า booking.thaiticketmajor.com ก่อน");
      return;
    }

    setActiveTabId(tab.id);

    try {
      if (isRunning) {
        await chrome.runtime.sendMessage({
          type: "STOP_TTM_RUN",
          tabId: tab.id
        });
        setIsRunning(false);
        setMessage("[STOP] หยุดการทำงานแล้ว");
        setDebugLogs((current) => appendLogEntries(current, ["--- manual stop ---"]));
        return;
      }

      const response = await chrome.runtime.sendMessage({
        type: "START_TTM_RUN",
        tabId: tab.id,
        payload: draft
      });
      setIsRunning(true);
      setDebugLogs((current) => appendLogEntries(current, ["--- manual start ---"]));
      if (!response?.ok) {
        throw new Error(response?.message ?? "ยังส่งคำสั่งไปหน้าเว็บไม่ได้");
      }

    } catch (error) {
      setIsRunning(false);
      setMessage(error instanceof Error ? error.message : "ไม่สามารถเริ่มทำงานได้");
    }
  }

  async function runValidatedHelper() {
    const validation = validateDraft(draft);

    if (!validation.ok) {
      if (validation.field === "url" && draft.url.trim()) {
        setDraft((current) => ({ ...current, url: "" }));
      }

      setMessage(validation.message);
      window.alert(validation.message);
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab?.id) {
      setIsRunning(false);
      setMessage("กรุณาเปิดแท็บก่อนเริ่มทำงาน");
      return;
    }

    try {
      if (isRunning) {
        await chrome.runtime.sendMessage({
          type: "STOP_TTM_RUN",
          tabId: tab.id
        });
        setIsRunning(false);
        setMessage("[STOP] หยุดการทำงานแล้ว");
        setDebugLogs((current) => appendLogEntries(current, ["--- manual stop ---"]));
        return;
      }

      let targetTabId = tab.id;

      if (!isTtmBookingUrl(tab.url)) {
        if (!validation.sanitizedUrl) {
          throw new Error("กรุณาเปิดหน้า booking.thaiticketmajor.com หรือใส่ลิงก์คอนเสิร์ตก่อนเริ่มทำงาน");
        }

        const updatedTab = await chrome.tabs.update(tab.id, {
          url: validation.sanitizedUrl
        });

        targetTabId = updatedTab?.id ?? tab.id;

        await new Promise<void>((resolve) => {
          const listener = (
            updatedTabId: number,
            changeInfo: chrome.tabs.TabChangeInfo
          ) => {
            if (updatedTabId === targetTabId && changeInfo.status === "complete") {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };

          chrome.tabs.onUpdated.addListener(listener);
        });
      }

      setActiveTabId(targetTabId);

      const response = await chrome.runtime.sendMessage({
        type: "START_TTM_RUN",
        tabId: targetTabId,
        payload: {
          ...draft,
          url: validation.sanitizedUrl ?? draft.url.trim()
        }
      });

      setIsRunning(true);
      setDebugLogs((current) => appendLogEntries(current, ["--- manual start ---"]));

      if (!response?.ok) {
        throw new Error(response?.message ?? "ยังส่งคำสั่งไปหน้าเว็บไม่ได้");
      }
    } catch (error) {
      setIsRunning(false);
      setMessage(error instanceof Error ? error.message : "ไม่สามารถเริ่มทำงานได้");
    }
  }

  async function logout() {
    if (refreshToken) {
      await extensionApi.logout(refreshToken).catch(() => null);
    }
    await storage.clearSession();
    setToken(null);
    setRefreshToken(null);
    setUser(null);
    setIsRunning(false);
    setMessage("ออกจากระบบแล้ว");
  }

  function resetDraft() {
    setDraft(createDefaultDraft());
    setMessage("ล้างข้อมูลแล้ว");
  }

  function verifyTtmUrl() {
    if (!draft.url.trim()) {
      window.alert("❌ กรุณากรอกลิงก์คอนเสิร์ตก่อนตรวจสอบ");
      return;
    }

    const sanitized = sanitizeConcertUrl(draft.url);
    if (sanitized) {
      setDraft((current) => ({ ...current, url: sanitized }));
      window.alert("✅ ลิงก์ถูกต้อง! (หน้าการจอง TTM)");
    } else if (isTtmBookingUrl(draft.url)) {
      window.alert("❌ ลิงก์ไม่ถูกต้อง! กรุณาระบุลิงก์ที่เป็นหน้าเลือกรอบ/โซนจองบัตร (เช่น /booking/...)");
    } else {
      window.alert("❌ ลิงก์ไม่ถูกต้อง! ต้องเป็นลิงก์ของ booking.thaiticketmajor.com");
    }
  }

  function toggleSection(section: SectionKey) {
    setActiveSection((current) => (current === section ? null : section));
  }

  const userStatus = toUserStatus(message, isRunning);

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(223,24,56,0.16),transparent_18rem),linear-gradient(180deg,#fff9fa_0%,#ffffff_100%)] flex flex-col items-center justify-center gap-6">
        {/* Logo with spinning ring */}
        <div className="relative flex items-center justify-center">
          {/* Spinning ring */}
          <svg className="spin-ring absolute" width="96" height="96" viewBox="0 0 96 96" fill="none">
            <circle cx="48" cy="48" r="44" stroke="#DF1838" strokeWidth="3" strokeLinecap="round"
              strokeDasharray="60 220" />
          </svg>
          {/* Logo */}
          <div className="pulse-logo w-20 h-20 rounded-full overflow-hidden shadow-lg shadow-brand-red/20">
            <img src="/logo.png" alt="Nongkapi TTM Helper" className="w-full h-full object-cover" />
          </div>
        </div>

        {/* App name */}
        <div className="text-center space-y-1">
          <p className="text-[13px] font-bold text-brand-red tracking-wide">{APP_CONFIG.extendtionName}</p>
          <p className="text-[11px] text-slate-400 font-medium"></p>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          <span className="dot-1 w-1.5 h-1.5 rounded-full bg-brand-red inline-block"></span>
          <span className="dot-2 w-1.5 h-1.5 rounded-full bg-brand-red inline-block"></span>
          <span className="dot-3 w-1.5 h-1.5 rounded-full bg-brand-red inline-block"></span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(223,24,56,0.16),transparent_18rem),linear-gradient(180deg,#fff9fa_0%,#ffffff_100%)] p-4 flex flex-col justify-center">
        <div className="mx-auto w-full max-w-sm rounded-[24px] border border-brand-line bg-white/95 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-sm">

          <div className="mb-6 flex flex-col items-center justify-center space-y-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-full overflow-hidden mb-2">
              <img src="/logo.png" alt="Nongkapi TTM Helper Logo" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-xl font-black text-brand-red text-center tracking-tight">{APP_CONFIG.extendtionName} </h1>
          </div>

          <form className="grid gap-4 mt-8" onSubmit={handleAuth}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[12px] font-semibold text-slate-600 ml-2">อีเมลผู้ใช้งาน</label>
              <input
                id="email"
                type="email"
                required
                className="w-full rounded-2xl border border-slate-200 bg-white/50 px-5 py-3.5 text-[12px] font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all placeholder-shown:border-slate-200 focus:border-brand-red focus:bg-white focus:ring-4 focus:ring-brand-red/10"
                placeholder="user@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <button
              className="mt-2 w-full rounded-2xl bg-gradient-to-br from-[#f12649] to-brand-redDark px-4 py-3.5 text-[12px] font-bold text-white shadow-lg shadow-brand-red/30 transition-all hover:translate-y-[-1px] hover:shadow-xl hover:shadow-brand-red/40 active:translate-y-[1px] active:shadow-sm disabled:pointer-events-none disabled:opacity-70 flex items-center justify-center gap-2"
              disabled={submitting}
              type="submit"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  <span>กำลังตรวจสอบ...</span>
                </>
              ) : "เข้าสู่ระบบ"}
            </button>
          </form>

          {message && (
            <div className={`mt-5 rounded-xl p-3 text-center text-[12px] font-medium ${message.includes("สำเร็จ") && !message.includes("ไม่สำเร็จ")
              ? "bg-green-50 text-green-600"
              : "bg-red-50/80 text-rose-600 border border-red-100"
              }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-brand-text font-sans">
      <header className="bg-[#1c1c1f] px-2 py-2 rounded-t-xl shadow-sm text-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border border-gray-600 bg-white flex items-center justify-center">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
          </div>
          <div className="text-xs ">
            <div className="font-extrabold text-sm text-white leading-tight">{APP_CONFIG.extendtionName} <span className="text-brand-red text-[12px] ml-1 font-normal">V{APP_CONFIG.displayVersion}</span></div>
            <div className="text-gray-400 text-[12px]">
              <div className=" mt-1">{user.email ?? ""}</div>
              {user.subscription?.startsAt && (
                <div className="mt-1 flex flex-col justify-start gap-0.5 text-[12px] text-gray-300">
                  <div>
                    <span className="opacity-80">วันที่สมัคร: </span>{formatDateThai(user.subscription.startsAt)}
                  </div>
                  <div>
                    <span className="opacity-80">วันหมดอายุ: </span>{formatDateThai(user.subscription.expiresAt)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-full flex-col gap-1 px-2 mt-1">
        {(["concert", "names", "citizens", "payment"] as SectionKey[]).map((section) => {
          let icon;
          if (section === "concert") icon = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
          else if (section === "names") icon = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>;
          else if (section === "citizens") icon = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>;
          else if (section === "payment") icon = <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>;

          return (
            <Section
              key={section}
              title={UI_SECTION_TITLES[section]}
              open={activeSection === section}
              onToggle={() => toggleSection(section)}
              icon={icon}
            >
              {section === "concert" ? (
                <div className="grid gap-3">
                  <Field label="ลิงก์คอนเสิร์ต">
                    <div className="grid grid-cols-[1fr_40px]">
                      <TextInput value={draft.url} onChange={(value) => setDraft((current) => ({ ...current, url: value }))} className="!rounded-r-none border-r-0" />
                      <button
                        type="button"
                        className="rounded-r-xl border border-gray-200 bg-gray-100 text-gray-600 hover:bg-green-500 hover:text-white hover:border-green-500 transition-colors flex items-center justify-center"
                        title="ตรวจสอบลิงก์"
                        onClick={() => verifyTtmUrl()}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      </button>
                    </div>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="รอบ">
                      <NumberInput value={draft.round} onChange={(value) => setDraft((current) => ({ ...current, round: value }))} />
                    </Field>
                    <Field label="โซน">
                      <TextInput value={draft.zones} onChange={(value) => setDraft((current) => ({ ...current, zones: value }))} />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="ราคา" hint="ไม่บังคับ">
                      <TextInput value={draft.price} onChange={(value) => setDraft((current) => ({ ...current, price: value }))} />
                    </Field>
                    <Field label="จำนวนบัตรที่ต้องการ">
                      <NumberInput value={draft.ticket} onChange={(value) => setDraft((current) => ({ ...current, ticket: value }))} />
                    </Field>
                  </div>
                  <Field label="วิธีเลือกที่นั่ง">
                    <SelectInput value={draft.seat_type} onChange={(value) => setDraft((current) => ({ ...current, seat_type: value }))} options={[...SEAT_RULE_OPTIONS]} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="เวลาเริ่มทำงาน" hint="ไม่บังคับ">
                      <TextInput value={draft.start_time} onChange={(value) => setDraft((current) => ({ ...current, start_time: value }))} />
                    </Field>
                    <Field label="โหมด">
                      <SelectInput value={draft.runMode} onChange={(value) => setDraft((current) => ({ ...current, runMode: value as HelperDraft["runMode"] }))} options={[{ value: "FAST", label: "⚡ เร็ว" }, { value: "MEDIUM", label: "🚶 กลาง" }, { value: "SAFE", label: "🐢 ช้า" }]} />
                    </Field>
                  </div>
                </div>
              ) : null}

              {section === "names" ? (
                <div className="grid gap-3">
                  {draft.names.map((nameValue, index) => (
                    <Field key={index} label={`ชื่อ #${index + 1}`} hint="ไม่บังคับ">
                      <TextInput
                        placeholder="ใส่ชื่อนามบัตรที่นี่"
                        value={nameValue}
                        onChange={(value) =>
                          setDraft((current) => {
                            const next = [...current.names];
                            next[index] = value;
                            return { ...current, names: next };
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              ) : null}

              {section === "citizens" ? (
                <div className="grid grid-cols-2 gap-3">
                  {(["code_1", "code_2", "code_3", "code_4"] as const).map((key, index) => (
                    <Field key={key} label={`รหัส #${index + 1}`} hint="ไม่บังคับ">
                      <TextInput
                        value={draft[key]}
                        onChange={(value) => setDraft((current) => ({ ...current, [key]: value }))}
                      />
                    </Field>
                  ))}
                </div>
              ) : null}

              {section === "payment" ? (
                <div className="grid gap-3">
                  <Field label="เบอร์โทรศัพท์" hint="ไม่บังคับ">
                    <TextInput
                      value={draft.phone_number}
                      onChange={(value) => setDraft((current) => ({ ...current, phone_number: value }))}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="วิธีการรับบัตร">
                      <SelectInput
                        value={draft.delivery}
                        onChange={(value) => setDraft((current) => ({ ...current, delivery: value }))}
                        options={[
                          { value: "pickup", label: "รับบัตรด้วยตัวเอง" },
                          { value: "postal", label: "จัดส่งทางไปรษณีย์" },
                          { value: "e-ticket", label: "อี-ทิกเก็ต" }
                        ]}
                      />
                    </Field>
                    <Field label="วิธีการชำระเงิน">
                      <SelectInput
                        value={draft.payment}
                        onChange={(value) => setDraft((current) => ({ ...current, payment: value }))}
                        options={[
                          { value: "credit-card", label: "บัตรเครดิต/เดบิต" },
                          { value: "cash-atm", label: "ชำระเงินสด และเอทีเอ็ม" },
                          { value: "mobile-wallet", label: "ชำระเงินผ่านมือถือ" },
                          { value: "direct-debit", label: "หักเงินผ่านบัญชี" },
                          { value: "qr", label: "คิวอาร์ พร้อมเพย์" },
                          { value: "kplus", label: "เคพลัส" },
                          { value: "truemoney", label: "ทรูมันนี่" }
                        ]}
                      />
                    </Field>
                  </div>
                </div>
              ) : null}
            </Section>
          );
        })}

        <div className="mt-2 text-center text-[12px] font-bold text-brand-red flex items-center justify-center gap-1.5">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zM9 13v-2h2v2H9zm0-8h2v5H9V5z" /></svg>
          อย่าลืม ล็อคอินเว็บไซต์ก่อนกดเริ่มใช้งานบอท
        </div>

        <button
          type="button"
          className={classNames(
            "rounded-xl px-4 py-3 text-[12px] font-bold text-white shadow-sm transition-colors mt-2",
            isRunning
              ? "bg-[#16161c]"
              : "bg-brand-red border-brand-red"
          )}
          onClick={runValidatedHelper}
        >
          {isRunning ? "หยุด" : " เริ่ม/หยุด"}
        </button>

        <section className="rounded-xl border border-brand-line bg-white p-3 mt-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-xs font-extrabold text-brand-text">สถานะการทำงาน</div>
            <button
              type="button"
              className="rounded-full border border-brand-line px-3 py-1 text-[12px] font-bold text-brand-text"
              onClick={() => setDebugLogs([])}
            >
              Clear
            </button>
          </div>
          <div ref={debugLogRef} className="max-h-[10rem] overflow-auto rounded-xl bg-slate-950 p-3 font-sans text-[12px] leading-4 text-emerald-300">
            {debugLogs.length ? (
              debugLogs.map((line, index) => (
                <div key={`${index}-${line}`}>{line}</div>
              ))
            ) : (
              <div className="text-slate-400">ยังไม่มีบันทึกสถานะ</div>
            )}
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2 mt-2">
          <button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-[12px] font-bold text-gray-700 flex justify-center items-center gap-2 hover:bg-gray-50" onClick={resetDraft}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            ลบข้อมูล
          </button>
          <button type="button" className="rounded-xl border border-gray-200 bg-white px-3 py-3 text-[12px] font-bold text-gray-700 flex justify-center items-center gap-2 hover:bg-gray-50" onClick={logout}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            ออกจากระบบ
          </button>
        </div>
        <div className="pt-2 pb-4 text-center text-xs text-gray-400">
          © 2026 NongKapi. All rights reserved.
        </div>
      </div>
    </div>
  );
}

function Section(props: { title: string; open: boolean; onToggle: () => void; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        className={classNames(
          "flex w-full items-center justify-between px-4 py-3 text-left text-[12px] font-bold transition-colors group",
          props.open ? "text-brand-red" : "text-gray-700 hover:text-brand-red"
        )}
        onClick={props.onToggle}
      >
        <div className="flex items-center gap-2">
          <div className={classNames("transition-colors", props.open ? "text-brand-red" : "text-gray-500 group-hover:text-brand-red")}>
            {props.icon}
          </div>
          <span>{props.title}</span>
        </div>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className={classNames("w-4 h-4 transition-transform duration-300", props.open ? "rotate-180" : "")}>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={classNames(
          "transition-[max-height,opacity,padding] duration-300 ease-in-out overflow-hidden border-t",
          props.open ? "max-h-[800px] opacity-100 border-gray-100 p-4" : "max-h-0 opacity-0 border-transparent p-0"
        )}
      >
        <div className="grid gap-3">{props.children}</div>
      </div>
    </section>
  );
}

function Field(props: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <div className="text-[12px] font-bold text-gray-600">
        {props.label}
        {props.hint ? <span className="font-normal text-gray-400"> ({props.hint})</span> : null}
      </div>
      {props.children}
    </div>
  );
}

function TextInput(props: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <input
      className={classNames(
        "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] outline-none transition-colors focus:border-brand-red focus:bg-white",
        props.className
      )}
      placeholder={props.placeholder}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    />
  );
}

function NumberInput(props: { value: string; onChange: (value: string) => void; placeholder?: string; className?: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min="0"
      step="1"
      className={classNames(
        "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] outline-none transition-colors focus:border-brand-red focus:bg-white",
        props.className
      )}
      placeholder={props.placeholder}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value.replace(/[^\d]/g, ""))}
    />
  );
}

function SelectInput(props: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select
      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-[12px] outline-none transition-colors focus:border-brand-red focus:bg-white"
      value={props.value}
      onChange={(event) => props.onChange(event.target.value)}
    >
      {props.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}








