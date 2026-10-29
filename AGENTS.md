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

## Default language: Java for backends (standing rule)

**Backends are written in Java (21, Spring Boot) by default, in this and any other project, unless the founder
explicitly agrees otherwise for that project.** Don't propose or start a backend in another language without that
agreement. Frontends may use TypeScript (Next.js here) as a UI-only client of the Java API.

## Stack & commands

**API (`backend/`)**: Java 21 · Spring Boot 4 (Web MVC, JdbcClient, Flyway, Actuator) · Postgres 16 with
row-level security · Maven multi-module (wrapper included) · JUnit 5, Testcontainers, ArchUnit.
**Web (`web/`)**: Next.js 15 (App Router, server components, server actions) · TypeScript strict · Tailwind 3 ·
Vitest. No other frameworks; keep dependencies minimal and pinned.

```sh
# Database: Postgres with an ordinary role (the API refuses superuser/BYPASSRLS roles)
psql -U postgres -f deploy/postgres-init.sql             # creates role + database "arcus" (password arcus)

# API: http://localhost:8080 (env: DATABASE_URL=jdbc:postgresql://..., DATABASE_USER, DATABASE_PASSWORD, APP_URL)
cd backend && ./mvnw -B verify                           # build + all tests (Testcontainers needs Docker,
                                                         #   or set ARCUS_TEST_DB_URL to a Postgres you own)
java -jar server/target/arcus-server.jar --spring.profiles.active=seed   # demo data, then exits
java -jar server/target/arcus-server.jar                 # migrations run on start

# Web: http://localhost:3000 (env: API_URL, default http://localhost:8080)
cd web && npm install && npm run dev
npm run typecheck && npm test && npm run build           # run all three before every commit
npm run e2e                                              # browser smoke test against running api + web, fresh seed

docker compose up --build                                # db + api + web; demo data: docker compose run --rm seed
```

Demo logins (password `demo1234`): `demo@example.com` (owner of a clinic and a law chamber),
`reception@example.com` (clinic front desk). CI (`.github/workflows/ci.yml`) runs the API tests, web checks,
a browser test of api + web together, and both Docker builds on every push. CD is an open item.

## Layout (details in docs/ARCHITECTURE.md)

```
backend/platform/      com.arcus.platform: kernel (tenant context, RLS transactions, config, auth filter, registry),
                       telemetry, channels, spi (app contract), services + REST controllers, modules (queue, appointments)
backend/apps/<app>/    com.arcus.apps.<app>: AppDefinition, services, controllers (/api/apps/<app>), Flyway SQL
backend/server/        the deployable Spring Boot app; its pom.xml chooses which apps run; demo seed
web/src/platform/      API client + types, session Ctx, action wrappers, UI contract, module UIs, shared UI
web/src/apps/<app>/    app.ts (UI extensions) + pages, actions, components
web/src/registry.ts    which app UIs the web contains
deploy/                postgres-init.sql (ordinary DB role for the API)
```

## Rules (don't break these)

- **Java backend, UI-only web.** Business rules, validation that matters, data access and messaging live in the
  API. The web only calls the API (`web/src/platform/api/client.ts`) and never talks to the database.
- **Boundaries** (tested by ArchUnit and `web/tests/boundaries.test.ts`): platform never depends on apps; apps
  never depend on each other; only platform/server code switches tenant scope (`Tx.system`, `Tx.asOrg`).
- **Tenant isolation is Postgres RLS.** Every tenant table has `org_id` and `arcus_enable_tenant_rls(...)`
  in its migration. Service methods that touch the database must run in a transaction (`@Transactional` or
  `Tx`); outside one, queries see no rows. Never connect the API as a superuser/BYPASSRLS role. Public pages use
  unguessable `publicCode`s and expose only what the link is for.
- **Platform stays domain-neutral.** No "patient", "doctor" or "case" in `platform/` code or `web/src/platform`;
  use `terms` and extension points. Need a new hook? Add it to the contract (`spi/` in Java, `kernel/types.ts` in
  the web), don't special-case an app.
- **Errors:** throw `UserError` (or `.NotFound` / `.Forbidden`) for messages users should see; anything else
  returns a generic message and is reported with a stack trace. Web server actions go through `formAction()` /
  `action()` / `publicFormAction()`; never export non-action helpers from a `"use server"` file.
- **Telemetry** comes from the platform: `Log` in Java; don't add another logger or error SDK in an app.
- **Config** only through Spring properties (`ArcusProperties`, `application.yml`); no `System.getenv`. In the
  web, only the API client and session code read `process.env`.
- **Messaging** only through `NotificationService`. Every customer-facing template needs English *and* Hindi.
  Respect `whatsapp_opt_in` (DPDP consent).
- **App tables** live in the app's own migrations (`db/apps/<app>/`), may reference `organizations`/`contacts`
  with `ON DELETE CASCADE`; platform tables never reference app tables (use `ref_type`/`ref_id`).
- **Money is integer paise** (`Money`, `formatMoney`). **Dates are IST** (`Ist`; the API sends instants as UTC ISO
  and days as `YYYY-MM-DD`). **Phones** are E.164 via `Phones.normalize` and *not* unique (families share numbers).
- **Billing changes are audited.** Discounts need a reason; voids need owner/admin + reason; never delete
  invoices or payments.
- **UI**: mobile-first, Tailwind classes from `globals.css` (`btn-*`, `input`, `card`, `table`), no horizontal
  scroll at 390px.
- Match the existing code's style and comment density. Keep commits focused; no secrets in git (`.env` is ignored).

## Current state (keep updated)

v0.3 (2026-10-29): backend rewritten in **Java** (Spring Boot 4, Maven modules platform / apps / server),
tenant isolation moved into Postgres row-level security, web reduced to a UI-only client of the API, separate
Docker images for api and web. All v0.2 features carried over (queue, consultations/e-Rx, billing with day book,
follow-ups, WhatsApp outbox, legal matters and hearing diary, appointments, dashboard, audit, module switches).
Verified: 28 JUnit tests (RLS isolation, API flows, ArchUnit), 16 web tests, typecheck, build, and the 15-flow
browser test against api + web, both locally and in Docker.

Next: see "Next" and "Open items" in `docs/STRATEGY.md`.
