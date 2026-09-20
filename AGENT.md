# Agent Instructions & Guidelines - Nongkapi TTM Helper

Welcome, AI Agent! This document defines the development rules, patterns, constraints, commands playbook, and context specifically tailored to help you navigate, modify, and build on this repository efficiently.

---

## 1. Quick Directory Reference

Use this mapping to locate code elements:
- **Automation State Machine**: [ttm-engine.ts](file:///c:/D/bot/src/content/ttm-engine.ts)
- **Extension Content Script Entry**: [content/index.ts](file:///c:/D/bot/src/content/index.ts)
- **Side Panel UI**: [sidepanel-app.tsx](file:///c:/D/bot/src/sidepanel/sidepanel-app.tsx)
- **Background Service Worker**: [background/index.ts](file:///c:/D/bot/src/background/index.ts)
- **Local Storage Wrapper**: [storage.ts](file:///c:/D/bot/src/shared/storage.ts)
- **TypeScript Types**: [types/index.ts](file:///c:/D/bot/src/types/index.ts)
- **Manifest V3 Config**: [manifest.ts](file:///c:/D/bot/src/manifest.ts)

---

## 2. Architecture & Rules

This project is a standalone **Manifest V3 Chrome Extension**:
- **Pure Offline Architecture**: There is NO external backend, auth server, or database.
- **Local Storage**: All draft configurations and preferences are stored in `chrome.storage.local`.
- **No Unused Abstractions (Ponytail principle)**: Keep dependencies minimal, no avoidable boilerplate.

---

## 3. Command Playbook

- **Install dependencies**: `pnpm install`
- **Typecheck**: `pnpm typecheck`
- **Build Extension**: `pnpm build`
- **Watch mode**: `pnpm dev:build`

---

## 4. Automation & WAF Evasion Rules

1. **Simulate Human Mouse Events**: Always use `dispatchMouseSequence(element, x, y)` to emit sequential `mousedown` -> `mouseup` -> `click`.
2. **Adaptive Delays**: Respect configured user delays (FAST, MEDIUM, SAFE) to prevent triggering bot detection.
3. **Graceful Stop**: On error alerts from TTM, the content script dispatches `FORCE_STOP_RUN` to halt automation and alert the user without altering local drafts.
