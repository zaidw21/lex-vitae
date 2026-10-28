# AGENTS.md: context for any AI coding agent (and humans)

This is the single source of truth for working on this repo. Tool-specific files (`CLAUDE.md`,
`GEMINI.md`, `.github/copilot-instructions.md`) only point here. **Read these before doing anything:**

1. This file: what the product is, how to work in the code, the rules.
2. `docs/ARCHITECTURE.md`: platform vs apps, the app/module contract, data model, boundaries.
3. `docs/DECISIONS.md`: every product decision so far, *why*, and what was rejected. Don't re-open a
   settled decision without the founder asking; propose instead.
4. `docs/STRATEGY.md`: thesis, pricing, go-to-market, roadmap (current and future scope, open items).
5. `docs/UX-REVIEW.md`: the UX backlog behind the roadmap's UX items.

## Keeping context alive (required)

Chat history does not travel between sessions or tools; only this repo does. So:

- When the founder makes or changes a decision in conversation, **append it to `docs/DECISIONS.md`**
  (date, decision, reason, alternatives rejected) in the same change as the work it affects.
- When scope changes, **update the roadmap in `docs/STRATEGY.md`** (move items between Next / Then / Done).
- When you change architecture, commands or conventions, **update this file and `docs/ARCHITECTURE.md`**.
- Never put secrets, patient/client data or credentials in these files.

## What we're building

**Arcus**: a WhatsApp-first platform for Indian practices in Tier 2/3 cities, with **domain apps** on top:
**Arcus Clinic** (doctors; first market, the founder has doctor contacts for pilots) and **Arcus Legal**
(advocates). Schools, CAs, labs and coaching are candidates later. Positioning: premium tools (queues,
records, billing controls, automated follow-ups) at ₹999–5,999/month, over WhatsApp, in Hindi and English.
"Arcus" is the company/platform name; customers buy "Arcus Clinic" / "Arcus Legal".

## Stack & commands

Next.js 15 (App Router, server components, server actions) · TypeScript strict · Prisma 6 + Postgres ·
Tailwind 3 · Vitest · Docker. No other frameworks; keep dependencies minimal and pinned.

```sh
cp .env.example .env && npm install            # set DATABASE_URL
npx prisma migrate deploy && npm run db:seed   # demo data: demo@example.com / demo1234, reception@example.com / demo1234
npm run dev                                    # http://localhost:3000
npm run typecheck && npm test && npm run build # run all three before every commit (tests need the database)
npm run e2e                                    # browser smoke test against a running, freshly seeded app
npx prisma migrate dev --name <change>         # after editing prisma/schema/*.prisma
docker compose up --build                      # whole platform + Postgres; demo data: docker compose run --rm seed
```

CI (`.github/workflows/ci.yml`) runs all of the above plus a Docker build on every push. CD is an open item.

## Layout (details in docs/ARCHITECTURE.md)

```
src/platform/   kernel (config, auth, tenant db, action wrappers, contract), telemetry, channels, services,
                modules (queue, appointments), actions, ui, lib
src/apps/<app>/ config.ts (no UI) + app.ts (UI extensions) + pages, actions, components, domain logic
src/registry.ts composition root: the apps this deployment runs
src/app/        Next.js routes; module/app pages are mounted by one-line re-export files
prisma/schema/  platform.prisma + apps/<app>.prisma
tests/          unit, boundaries, tenant isolation (real DB), e2e/smoke.cjs (Playwright)
```

## Rules (don't break these)

- **Boundaries** (tested): platform never imports apps (only `@/registry`); apps never import each other;
  apps never import `@/platform/lib/db`, provider adapters, `@/registry` or the Prisma runtime (`import type` is fine).
- **Tenant isolation.** App code uses `ctx.db` (tenant-scoped) only. Platform code using the raw `db` must
  filter by `ctx.org.id`. Public pages use unguessable `publicCode`s and expose only what the link is for.
- **Platform stays domain-neutral.** No "patient", "doctor" or "case" in `src/platform`; use `ctx.app.terms`
  and extension points. Need a new hook? Add it to the contract in `kernel/types.ts`, don't special-case an app.
- **Server actions** go through `formAction()` / `action()` / `publicFormAction()` (auth, logs, timing, error
  capture). Throw `UserError` for messages users should see; anything else shows a generic message and is
  reported. Never export non-action helpers from a `"use server"` file (they become callable from the browser).
- **Telemetry** comes from the platform: use `log` from `@/platform/telemetry/logger`; don't add another
  logger or error SDK in an app.
- **Config** only via `config()` in `kernel/config.ts`; nothing else reads `process.env`.
- **Messaging** only through `notify()`/`deliver()`. Every customer-facing template needs English *and* Hindi.
  Respect `whatsappOptIn` (DPDP consent).
- **App tables** live in `prisma/schema/apps/<app>.prisma` with plain `orgId`, no relations to platform models;
  link platform records to them with `refType`/`refId`.
- **Money is integer paise** (`rupeesToPaise`, `formatMoney`). **Dates are IST** (`istDate`, `istDayRange`).
  **Phones** are E.164 via `normalizePhone` and *not* unique (families share numbers).
- **Billing changes are audited.** Discounts need a reason; voids need owner/admin + reason; never delete
  invoices or payments.
- **UI**: mobile-first, Tailwind classes from `globals.css` (`btn-*`, `input`, `card`, `table`), no horizontal
  scroll at 390px.
- Match the existing code's style and comment density. Keep commits focused; no secrets in git (`.env` is ignored).

## Current state (keep updated)

v0.2 (2026-10-28): renamed to Arcus; platform/app separation with enforced boundaries; tenant-scoped database;
platform telemetry (structured logs, error capture, request context); messaging channel ports/adapters;
config module; health endpoint; per-organization module switches; Docker image + compose; CI workflow.
All v0.1 features carried over (queue, consultations/e-Rx, billing with day book, follow-ups, WhatsApp outbox,
legal matters and hearing diary, appointments, dashboard). Verified: typecheck, 29 unit/boundary/isolation tests,
build, 15-flow browser test locally and against the Docker image.

Next: see "Next" and "Open items" in `docs/STRATEGY.md`.
