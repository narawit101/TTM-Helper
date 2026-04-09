# Ticket Helper Workspace

Monorepo with two active apps:

- `apps/admin`: Next.js full-stack admin app
- `apps/extension`: Chrome extension

## Webapp

`apps/admin` now owns:

- web UI
- API routes under `app/api`
- Prisma schema and seed under `prisma`
- database access under `src/lib`

Current admin scope is intentionally minimal:

- admin login with email + password
- fetch and display rows from the `Admin` and `User` tables

## Quick Start

1. Copy env files

```bash
cp apps/admin/.env.example apps/admin/.env
cp apps/extension/.env.example apps/extension/.env
```

2. Install dependencies

```bash
pnpm install
```

3. Start Postgres

```bash
docker compose up -d
```

4. Generate Prisma client

```bash
pnpm prisma:generate
```

5. Seed the admin user from `apps/admin/.env`

```bash
pnpm prisma:seed
```

6. Run both apps

```bash
pnpm dev
```

## URLs

- Admin: `http://localhost:3000/login`
- Dashboard: `http://localhost:3000/dashboard`
- Admin health: `http://localhost:3000/api/health`

## Extension

Build and reload the extension from:

```bash
pnpm --filter extension build
```

Then load unpacked from `apps/extension/dist`.
