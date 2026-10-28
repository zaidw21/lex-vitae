# AGENTS.md: context for any AI coding agent (and humans)

This is the single source of truth for working on this repo. Tool-specific files (`CLAUDE.md`,
`GEMINI.md`, `.github/copilot-instructions.md`) only point here. **Read these before doing anything:**

1. This file: what the product is, how the code is organised, the rules.
2. `docs/DECISIONS.md`: every product decision so far, *why*, and what was rejected. Don't re-open a
   settled decision without the founder asking; propose instead.
3. `docs/STRATEGY.md`: thesis, pricing, go-to-market, roadmap (current and future scope).
4. Pending work: `docs/ARCHITECTURE-V2.md` (platform + plugins + apps, proposed) and `docs/UX-REVIEW.md`.

## Keeping context alive (required)

Chat history does not travel between sessions or tools; only this repo does. So:

- When the founder makes or changes a decision in conversation, **append it to `docs/DECISIONS.md`**
  (date, decision, reason, alternatives rejected) in the same change as the work it affects.
- When scope changes, **update the roadmap in `docs/STRATEGY.md`** (move items between Next / Then / Done).
- When you change architecture, commands or conventions, **update this file**.
- Never put secrets, patient/client data or credentials in these files.

## What we're building

**Daftar**: a WhatsApp-first practice OS for Indian professionals in Tier 2/3 cities. One platform core
plus *vertical packs* per profession, so we can follow traction. Clinics (doctors) are the first
market: the founder has doctor contacts for pilots. Legal (advocates) is the second pack. Schools, CAs, labs and
coaching are candidates for later. Positioning: premium tools (queues, records, billing controls,
automated follow-ups) at ₹999–5,999/month, delivered over WhatsApp, in Hindi and English.

## Stack & commands

Next.js 15 (App Router, server components, server actions) · TypeScript strict · Prisma 6 + Postgres ·
Tailwind 3 · Vitest. No other frameworks; keep dependencies minimal and pinned.

```sh
cp .env.example .env && npm install
npx prisma migrate deploy && npm run db:seed   # demo data (logins: demo@daftar.in / demo1234, reception@daftar.in / demo1234)
npm run dev                                    # http://localhost:3000
npm run typecheck && npm test && npm run build # run all three before every commit
npm run e2e                                    # browser smoke test against a running, freshly seeded app
npx prisma migrate dev --name <change>         # after editing prisma/schema.prisma
```

## Layout

```
prisma/schema.prisma     one data model shared by all verticals (vertical detail in JSON `data`/`fields`)
prisma/seed.ts           demo clinic + demo law chamber, dated relative to today
src/core/                platform services: auth/sessions, contacts, queue, billing, messaging, audit, insights, provisioning
src/verticals/           vertical packs: types.ts (contract), clinic/, legal/, index.ts (registry)
src/actions/             server actions: every write goes through here
src/app/app/             signed-in product pages; src/app/{t,d,r,display}: public pages
src/components/          shared UI (ui.tsx primitives, ActionForm, editors, document/receipt sheets)
tests/                   unit tests (vitest) and tests/e2e/smoke.cjs (Playwright)
```

## Rules (don't break these)

- **Tenant isolation.** Every query filters by `orgId` taken from `requireCtx()` (the session), never from the
  URL or form. Look records up with `findFirst({ where: { id, orgId } })`. Public pages use unguessable
  `publicCode`s and expose only what the link is for (the TV display shows token numbers, never names).
- **Vertical-neutral core.** Code in `src/core` never says "patient"/"doctor"/"case". Use `ctx.pack.terms`
  and `requireModule(ctx, "...")`. Profession-specific logic lives in `src/verticals/<pack>/`.
- **New vertical** = add to the `Vertical` enum + migration, a `VerticalPack` in `src/verticals/<name>/`,
  register it in `src/verticals/index.ts`, and add pages only for what is unique to it.
- **Money is integer paise.** Parse with `rupeesToPaise`, show with `formatMoney`.
- **Dates are IST.** "Today" = `istDate()`; calendar dates are UTC-midnight `@db.Date`; day ranges via `istDayRange`.
- **Phones** are stored E.164 via `normalizePhone`. Phone is *not* unique: Indian families share numbers.
- **Messaging** only through `notify()`/`deliver()` in `src/core/messaging.ts`. Every customer-facing
  template needs English *and* Hindi in the pack. Respect `whatsappOptIn` (DPDP consent).
- **Billing changes are audited.** Discounts need a reason; voids need owner/admin + reason; never delete
  invoices or payments. Use `src/core/billing.ts`.
- **Forms**: server actions return `FormState`; wrap errors with `fail()` (it re-throws Next redirects and
  hides internal errors). Use `ActionForm` + `SubmitButton` on the client.
- **UI**: mobile-first (the front desk is often a phone), Tailwind classes from `globals.css` (`btn-*`,
  `input`, `card`, `table`), no horizontal scroll at 390px.
- Match the existing code's style and comment density. Keep commits focused; no secrets in git (`.env` is ignored).

## Current state (keep updated)

Built (v0.1): signup/login, multi-org switch, team roles, contacts with consent, appointments, clinic queue +
TV display + public token page, consultations with e-prescriptions (Hindi dosing) and print/WhatsApp,
billing with day book and audit log, follow-ups, WhatsApp outbox (test mode), dashboard insights, legal
matters + hearing diary + client updates, settings/catalog, demo seed, unit + e2e tests.

Not built yet, in priority order: see "Next" in `docs/STRATEGY.md`. Biggest go-live blockers: WhatsApp
approved templates, phone OTP login, scheduled reminder jobs, UPI payment links, hosting.
