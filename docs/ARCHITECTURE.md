# Architecture

Arcus is **one platform** that runs **domain apps** (Arcus Clinic, Arcus Legal, …). It is a single
Next.js application and a single Postgres database, deployed as one Docker image. The separation between
platform and apps is enforced in code (see "Boundaries"), not by running separate services.

```
src/platform/            THE PLATFORM: everything any app gets for free
  kernel/                config, auth & sessions, Ctx, tenant-scoped db, action wrappers, app/module contract, health
  telemetry/             structured logger, error capture, request context (org/user/app/request id)
  channels/              messaging ports + provider adapters (WhatsApp: Meta Cloud API, log/test mode)
  services/              contacts, billing, messaging, audit, insights, templates, provisioning, settings helpers
  modules/               optional platform features apps switch on: queue/, appointments/
  actions/               server actions for platform screens (contacts, billing, tasks, settings, auth…)
  ui/                    shared components and design primitives
  lib/                   money, time (IST), phone, ids, forms, errors
src/apps/<app>/          A DOMAIN APP
  config.ts              terms, modules, defaults, message templates, provisioning (no UI, safe for scripts)
  app.ts                 config + the UI it plugs into the platform (nav, widgets, slots, renderers)
  actions.ts, pages/, components/, domain logic
src/registry.ts          composition root: which apps this deployment runs
src/app/                 Next.js routes: platform pages + one-line files that mount module/app pages
src/instrumentation.ts   sends every unhandled request error to the platform's error reporter
prisma/schema/           platform.prisma + apps/<app>.prisma (one database, schema split by owner)
```

## What the platform provides (apps never re-implement these)

| Capability | Where | How apps use it |
|---|---|---|
| Auth, sessions, roles, multiple practices per user | `kernel/auth.ts` | `requireCtx()` → `Ctx` |
| **Tenant isolation** | `kernel/tenant-db.ts` | `ctx.db`: every read/write is scoped to the organization automatically |
| **Telemetry** (structured logs, errors, timing, request context) | `telemetry/`, `kernel/actions.ts`, `instrumentation.ts` | Automatic for every action and page; `log.info()` for extra events |
| Server-action plumbing (auth, error mapping, logging) | `kernel/actions.ts` | `formAction()`, `action()`, throw `UserError` for user-facing messages |
| Configuration | `kernel/config.ts` | Validated env, read in one place |
| Messaging channels | `channels/` + `services/messaging.ts` | `notify(ctx, contact, "KEY", vars)`; provider picked by config |
| Message templates (en + hi) | `services/templates.ts` | Override any key in the app's `messages` |
| Contacts with DPDP consent, appointments, queue, billing with cash control, documents, tasks, audit log, insights | `services/`, `modules/` | Shared screens + services |
| Health check | `/api/health` | Used by Docker, load balancers, CD |

## The app/module contract (`kernel/types.ts`)

- **`AppConfig`**: id, product name, terms ("Patient"/"Client"), modules to switch on, contact fields,
  default services and settings, message templates, a `provision` hook for new organizations.
- **`AppManifest`** = `AppConfig` + UI extension points: `nav`, dashboard `widgets`, `contactActions`,
  `contactSections`, `settingsSections`, `documentRenderers` (e.g. prescriptions), `queue.startHref`.
- **`ModuleManifest`**: the same extension points, for optional platform features (queue, appointments).
  Organizations switch modules on/off in Settings (allowed set = app's `modules` + `optionalModules`).

## Data

- One Postgres database. `prisma/schema/platform.prisma` owns platform tables. Each app owns its tables in
  `prisma/schema/apps/<app>.prisma` with a plain `orgId` column and **no relations into platform models**,
  so adding an app never edits the platform schema.
- Platform records point at app records with `refType` + `refId` (e.g. an invoice for a legal matter).
- Because app tables have no foreign key to `Organization`, deleting an organization does not cascade to
  them. There is no org-deletion flow yet; when one is built, each app needs a cleanup hook.

## Boundaries (enforced by `tests/boundaries.test.ts`)

1. The platform never imports an app; it reaches apps only through `src/registry.ts`.
2. Apps never import each other.
3. Apps never use the raw database client, provider adapters, the registry or the Prisma runtime.
Tenant isolation is proven against a real database by `tests/tenant-db.test.ts`.

## Adding an app

1. `src/apps/<id>/config.ts` (`AppConfig`) and `app.ts` (`AppManifest`), plus its pages/actions.
2. Its own tables (if any) in `prisma/schema/apps/<id>.prisma`, then `npx prisma migrate dev`.
3. One entry in `src/registry.ts`, and one-line route files under `src/app/app/...` for its pages.
No platform file changes.

## Deferred on purpose

A dynamic plugin framework (apps loaded at runtime, independent versioning) is **not** built. Revisit when
a third app has paying customers, outside developers want to build apps, or per-module selling becomes
material. The boundaries above keep that migration mechanical.
