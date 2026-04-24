# Ticket Helper Platform

A production-oriented monorepo for managing ticket-booking accounts and running a Chrome extension workflow for ThaiTicketMajor.

This project is split into two main apps:

- `apps/admin` — a Next.js full-stack admin dashboard with API routes, Prisma, PostgreSQL, Redis, and validation
- `apps/extension` — a Manifest V3 Chrome extension that helps users prepare and run a guided booking flow on ThaiTicketMajor

## Project Summary

Ticket Helper Platform was built to solve two related problems:

1. Give admins a simple web interface to manage users, access windows, and device limits
2. Give end users a browser extension that can log in with a provisioned account, persist booking preferences, and guide or automate repetitive booking steps on supported ticket pages

The codebase is organized as a pnpm workspace so the admin app, extension, and shared TypeScript contracts can evolve together without duplicating models or API shapes.

## Key Features

### Admin Dashboard

- Email/password admin login
- Full-stack Next.js API under `app/api`
- User CRUD for access-controlled extension accounts
- Device quota management per user
- Expiration date management for user access
- Session-based admin authentication
- Redis-backed user cache invalidation
- Zod validation for auth and user payloads
- Prisma ORM with PostgreSQL

### Chrome Extension

- Side panel UI for login and booking configuration
- Device-aware account login using a unique device key
- Persistent draft storage for booking settings
- Guided booking flow for ThaiTicketMajor pages
- Zone detection and zone fallback support
- Multiple seat-selection strategies
- Booking detail autofill support
- Real-time status log inside the side panel
- Forced stop/logout handling when an account expires or becomes unavailable

### Shared Workspace Package

- Shared TypeScript types and API contracts between admin and extension
- Reusable auth and user-facing data shapes
- Shared constants for roles, plans, statuses, and permissions

## Tech Stack

### Frontend

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- React Hook Form
- CRXJS + Vite for Chrome Extension development

### Backend / Data

- Next.js Route Handlers
- Prisma ORM
- PostgreSQL
- Redis via `ioredis`
- Zod
- JSON Web Tokens
- bcryptjs

### Tooling

- pnpm workspaces
- Vite
- tsx
- PostCSS

## Architecture

```text
bot/
├─ apps/
│  ├─ admin/       # Next.js full-stack admin app
│  └─ extension/   # Chrome extension (MV3)
├─ packages/
│  └─ shared/      # shared contracts, constants, and types
└─ README.md
```

### `apps/admin`

Owns the web app and backend runtime:

- admin UI
- API routes
- Prisma schema and seed scripts
- PostgreSQL access
- Redis access
- validation and auth logic

### `apps/extension`

Owns the browser-side workflow:

- side panel UI
- background worker
- content scripts
- booking-page state detection
- local persisted session and booking draft data

## Main Booking Workflow

At a high level, the extension flow is:

1. User logs in with a provisioned account
2. Extension stores a device identity and validates account status through the admin API
3. User sets booking inputs such as URL, round, zone, ticket count, seat rule, payment, and delivery
4. Extension opens the booking page and monitors the current page state
5. Extension applies the next allowed action for the detected state
6. If the account expires or becomes unavailable, the extension stops the run and clears the session

## Data Model

The current Prisma schema includes:

- `Admin`
  - admin credentials for the dashboard
- `User`
  - managed extension accounts with email, expiry date, and device limit
- `Device`
  - registered devices for each user account

This model allows one admin dashboard to provision multiple user accounts while controlling device usage per account.

## Security Notes

The project currently includes:

- server-side environment variables for database and Redis access
- session-based admin authentication
- extension account expiry checks
- device-limit enforcement
- Redis-backed cache clearing for user data updates

## Local Development

### 1. Install dependencies

```bash
pnpm install
```

### 2. Prepare admin environment

Use one of the built-in scripts:

```bash
pnpm env:local
```

or

```bash
pnpm env:prod
```

### 3. Generate Prisma client

```bash
pnpm prisma:generate
```

### 4. Sync database schema

For local development:

```bash
pnpm prisma:migrate
```

For production-style schema sync:

```bash
pnpm --filter admin prisma:push
```

### 5. Seed admin data

```bash
pnpm prisma:seed
```

### 6. Run the workspace

```bash
pnpm dev
```

## Useful Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm env:local
pnpm env:prod
pnpm prisma:generate
pnpm prisma:migrate
pnpm prisma:migrate:deploy
pnpm prisma:seed
pnpm --filter extension build
```

## Default Local URLs

- Admin login: `http://localhost:3000/login`
- Admin dashboard: `http://localhost:3000/dashboard`
- Health check: `http://localhost:3000/api/health`

## Why This Project Stands Out

This project combines:

- full-stack admin tooling
- browser extension development
- cross-app shared contracts
- account/device access control
- real-world workflow automation on a third-party booking site

It is a strong portfolio piece because it demonstrates product thinking, full-stack architecture, browser extension engineering, and operational concerns like auth, caching, validation, and deployment readiness in one repo.
