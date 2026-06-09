# Agent Instructions & Guidelines - Ticket Helper Platform

Welcome, AI Agent! This document defines the development rules, patterns, constraints, commands playbook, and context specifically tailored to help you navigate, modify, and build on this repository efficiently.

---

## 1. Quick Directory Reference

Use this mapping to locate code elements:
- **Prisma Schema & DB config**: [schema.prisma](file:///c:/D/bot/apps/admin/prisma/schema.prisma)
- **Extension Content Engine**: [ttm-engine.ts](file:///c:/D/bot/apps/extension/src/content/ttm-engine.ts)
- **Extension Entry Point**: [content/index.ts](file:///c:/D/bot/apps/extension/src/content/index.ts)
- **Extension UI Panel**: [sidepanel-app.tsx](file:///c:/D/bot/apps/extension/src/sidepanel/sidepanel-app.tsx)
- **Admin App API Routes**: [apps/admin/src/app/api](file:///c:/D/bot/apps/admin/src/app/api)
- **Shared Types**: [packages/shared/src](file:///c:/D/bot/packages/shared/src)

---

## 2. Project Architecture & Monorepo Rules

The project is structured as a **pnpm workspace monorepo**:
- **`apps/admin`**: Next.js 15 App Router dashboard for user registration, plan/expiration dates, and device quota limits.
- **`apps/extension`**: Chrome Extension Manifest V3 helper which automates/guides booking workflows on ThaiTicketMajor (TTM).
- **`packages/shared`**: Reusable TypeScript contracts, roles, plans, presets, and validation shapes exported as `@ticket-helper/shared`.

### 2.1 Importing Shared Utilities
- **Rule**: Never copy-paste shared schemas or types. Always import them from `@ticket-helper/shared` in both `apps/admin` and `apps/extension`.
- **Imports structure**:
  ```typescript
  import { TicketPresetInput } from "@ticket-helper/shared";
  ```

### 2.2 Keep Shared Types Updated
If you are changing the configuration presets, account shapes, or payment methods, edit them in `packages/shared/src` first, then run `pnpm typecheck` to verify that the changes compile in both `apps/admin` and `apps/extension`.

---

## 3. Command Execution Playbook

When executing shell commands on this workspace:
1. **Never use `cd` commands**: Always specify the target path in the `Cwd` parameter of your tool call.
2. **Pnpm Workspaces**: Use pnpm commands from the root:
   - Install dependencies: `pnpm install`
   - Run dev environment (Next.js + Extension watcher): `pnpm dev`
   - Run type checking: `pnpm typecheck`
   - Build production packages: `pnpm build`
3. **Admin / Prisma Commands**:
   - Generate Prisma client: `pnpm prisma:generate` (or `pnpm --filter admin prisma:generate`)
   - Run local migrations: `pnpm prisma:migrate`
   - Seed local database: `pnpm prisma:seed`
4. **Extension Commands**:
   - Re-build Chrome Extension: `pnpm --filter extension build`
   - Watch build Extension: `pnpm --filter extension dev:build`

---

## 4. Chrome Extension Rules & WAF Evasion

The Chrome extension acts as an automation/guidance script on `booking.thaiticketmajor.com` pages. Because of web application firewalls (WAF) and bot-detection engines:

### 4.1 Web Event Simulation & Clicks
- **Rule**: **Do not** trigger inline JavaScript functions directly on elements (e.g., executing raw `onclick` values) as this easily triggers bot detection.
- **Rule**: Use native mouse sequence simulation. Trigger events in sequence: `mousedown` -> `mouseup` -> `click`.
- **Implementation**: Call the utility function `dispatchMouseSequence(target, x, y)` or `clickElement(element)` from `ttm-engine.ts`.
- **Map Areas & SVGs**: TTM utilizes `<map> <area>` elements for concert map zones and SVG elements for seating charts. Always use scale-aware calculation mapping coordinates via `getAreaClientPoint` to hit the center of map areas.

### 4.2 HTML/SVG Target Selector Precautions
The automation engine in `ttm-engine.ts` heavily relies on page selectors. If you are asked to adjust selectors or automate new elements:
- Read the page structure and text content in Thai and English (TTM features dual-language content).
- Normalize text matches using `normalizeText(val)` or `compactText(val)`.
- Test if elements are visible via the `visible(node)` helper before triggering clicks.

### 4.3 Page State Detection & Transitions
The content scripts evaluate the page state via `detectTtmPageState()` which yields:
- `"zones"`: Page with concert zone maps (`zones.php`).
- `"seats"`: Page with seat selections.
- `"details"`: Page with customer/ticket details.
- `"payment"`: Page with payment method choices (`paymentall.php`).
- `"queue"`: Wait queue page.
- `"success"`: Success page.
- `"unknown"`: Pages not recognized.

- **Rule**: When adding new steps or features to `ttm-engine.ts` or `index.ts`, ensure state checking handles edge cases where pages reload or elements load dynamically.

### 4.4 Delay & Speed Customization
- **Rule**: Respect the user's run mode configurations. Introduce state delays depending on whether the active preset is set to `FAST`, `MEDIUM`, or `SAFE` to avoid IP bans or WAF rate-limiting. Refer to `getModeDelays` inside `apps/extension/src/content/index.ts`.

### 4.5 Service Worker Persistence (Background script)
- **Rule**: Chrome extensions can suspend active background workers. The system uses a keepalive alarm `sw-keepalive` every ~20 seconds to keep the background worker awake. Maintain this mechanism during updates.

### 4.6 Side Panel Login & Session Expiry Flow
- Extension logins are tied to a unique device key stored in `chrome.storage.local`.
- The background service worker acts as a proxy for API calls (refresh tokens, checking credentials, logging out) to prevent CORS issues.
- Do not make direct HTTP requests from content scripts. Use `chrome.runtime.sendMessage` to delegate auth calls to the background script.

---

## 5. Backend & Admin Rules (`apps/admin`)

- **Next.js 15 Route Handlers**: Locate API routes inside `src/app/api/auth/*` or user routing.
- **Database & Prisma**: PostgreSQL database client defined in `src/lib/prisma.ts`. Ensure to run `pnpm prisma:generate` if changing schema.
- **Caching**: Redis client in `src/lib/redis.ts` is used for caching user sessions and invalidating them dynamically upon changes in user status or limits.
- **Strict Typing**: Always enforce strict mode. Avoid the use of `any` types. Ensure Prisma models match types imported from `@ticket-helper/shared`.

---

## 6. Verification & Troubleshooting

### 6.1 Verification Workflow
Before concluding any development cycles:
1. **Lint/Type-Check**: Run typecheck at the monorepo root:
   ```bash
   pnpm typecheck
   ```
2. **Build Verification**: Make sure both applications compile without error:
   ```bash
   pnpm build
   ```
3. **Environment Setup**: Do not modify raw `.env` files directly. Add placeholder keys to `.env.example` under each package/app when introducing new settings.

### 6.2 Troubleshooting & Debugging
- **Typecheck Errors**: If you encounter type checking errors after editing `@ticket-helper/shared`, it's usually because the dependencies in `node_modules` need syncing. Run `pnpm install` or ensure the TypeScript compiler checks the local workspace package references.
- **CSP/Script Errors**: Manifest V3 extension pages restrict inline script executions. Do not inject inline script tags or evaluate string statements. Use native DOM API interfaces and messages.
