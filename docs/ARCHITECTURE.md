# Architecture

Arcus is **one platform** that runs **domain apps** (Arcus Clinic, Arcus Legal, …). It is deployed as two
processes and one database:

```
browser ──► web (Next.js, UI only) ──HTTP/JSON──► api (Java 21, Spring Boot 4) ──► Postgres (row-level security)
```

- **`backend/`: the API.** All business logic, data access, tenant isolation, messaging and telemetry. Java is
  the default backend language for this and every project (see `docs/DECISIONS.md`, 2026-10-29).
- **`web/`: the UI.** Next.js server components and server actions that call the API with the user's session
  token. It has no database access and no business rules; it renders and validates input shape only.

The separation between platform and apps is enforced in code (ArchUnit in the backend, a boundary test in the
web), not by running separate services per app.

## Backend layout (Maven multi-module, `backend/`)

```
platform/   com.arcus.platform: THE PLATFORM, everything any app gets for free
  kernel/       config (ArcusProperties), principal + TenantContext, tenant transaction manager (RLS),
                Tx helper, migrations, AppRegistry, DB safety check; web/: auth filter, errors → JSON
  telemetry/    Log helper, Cloud Logging JSON formatter (+ Error Reporting format), request telemetry filter
  channels/     messaging ports + adapters (WhatsApp Meta Cloud API, log/test mode)
  spi/          the app/module contract: AppDefinition, ModuleDefinition, Terms, FieldDef, Template…
  auth, orgs, contacts, encounters, documents, billing, messaging, tasks, insights, audit, publiclinks
  modules/      optional platform features apps switch on: queue/, appointments/
  support/      Ist (dates), Money (paise), Phones (E.164), Ids, Json, Sql, Strings
  resources/db/platform/   Flyway migrations for platform tables
apps/<app>/  com.arcus.apps.<app>: A DOMAIN APP (clinic, legal)
  <App>App.java          implements AppDefinition (terms, modules, templates, provisioning)
  services + controllers under /api/apps/<app>/…
  <App>AutoConfiguration + META-INF/spring/…AutoConfiguration.imports (how the app plugs in)
  resources/db/apps/<app>/  the app's own Flyway migrations
server/      com.arcus.server: the deployable. pom.xml lists the apps this deployment runs; DemoSeed (profile "seed")
```

## Web layout (`web/`)

```
src/platform/   api/ (typed API client + response types), kernel/ (session Ctx, action wrappers, UI contract),
                modules/ (queue, appointments UI), actions/, ui/, lib/ (display formatting, form parsing)
src/apps/<app>/ app.ts (UI extensions: nav, widgets, slots, document renderers) + pages, actions, components
src/registry.ts which app UIs this web build contains, keyed by app id
src/app/        Next.js routes; module/app pages are mounted by one-line re-export files
tests/          unit + boundary tests (vitest), e2e/smoke.cjs (Playwright, needs api + web running)
```

## What the platform provides (apps never re-implement these)

| Capability | Where (backend) | How apps use it |
|---|---|---|
| Auth, sessions (bearer tokens, hashed), roles, several practices per user | `auth/`, `kernel/web/AuthFilter` | `TenantContext.require()` → `Principal` |
| **Tenant isolation** | Postgres RLS + `kernel/TenantTransactionManager` | Automatic: every transaction is scoped to the caller's org |
| **Telemetry** (JSON logs, error reporting, request timing, org/user/app/request context) | `telemetry/` | Automatic for every request; `Log.info(...)` for extra events |
| Errors users should see | `kernel/web/UserError` | Throw `UserError` (400), `.NotFound`, `.Forbidden` |
| Configuration | `kernel/ArcusProperties` (`arcus.*` in application.yml) | Inject `ArcusProperties` |
| Migrations | `kernel/Migrations` | Put SQL in `db/apps/<id>/`; own history table `flyway_app_<id>` |
| Messaging channels + templates (en + hi) | `channels/`, `messaging/` | `NotificationService.notify(...)`; override template keys in `messages()` |
| Contacts with DPDP consent, appointments, queue, billing with cash control, documents, tasks, audit, insights | services in each package | Inject the service |
| Health | `/actuator/health` (+ liveness/readiness) | Used by Docker, load balancers, CD |

## Tenant isolation (how it works)

- Every tenant table has `org_id` and a `FORCE ROW LEVEL SECURITY` policy (`arcus_enable_tenant_rls(table)`).
- `TenantTransactionManager` sets `arcus.org_id` (or `arcus.bypass` for system work) with `set_config(..., true)`
  at the start of each transaction, so the setting dies with the transaction and can't leak between pooled
  connections. **Outside a transaction, queries see no rows** (fail-closed): a missing `@Transactional` shows
  up as "not found", never as another practice's data.
- Org scope comes from the session (`AuthFilter`). Only platform/server code may use `Tx.system` / `Tx.asOrg`
  (ArchUnit-enforced); apps can't widen their scope.
- The API refuses to start if its database role is a superuser or has BYPASSRLS (`DatabaseSafetyCheck`).
- `TenantIsolationTest` checks that every table with `org_id` has RLS forced and that one org can't read another's rows.

## The app/module contract

- **Backend `AppDefinition`** (Spring bean): id, name, tagline, terms ("Patient"/"Client"), practitioner prefix,
  modules (+ optional modules), contact fields, default services and settings, message templates,
  `provision(orgId, db)` for new organizations. **`ModuleDefinition`**: id, name, description, templates.
- **Web `AppUi` / `ModuleUi`** (`web/src/platform/kernel/types.ts`): `nav`, dashboard `widgets`, `contactActions`,
  `contactSections`, `settingsSections`, `documentRenderers` (e.g. prescriptions), `queue.startHref`.
  The web merges the API's app info with its `AppUi` into `ctx.app`.
- Organizations switch modules on/off in Settings (allowed set = app's `modules` + `optionalModules`).

## Data

- One Postgres database, standardised (no engine abstraction). snake_case columns, `uuid` ids, `timestamptz`,
  money as `bigint` paise, calendar days as `date` (IST).
- Platform tables in `platform/src/main/resources/db/platform`. Each app owns its tables in
  `apps/<app>/src/main/resources/db/apps/<app>`. App tables may reference platform tables (`organizations`,
  `contacts`) with `ON DELETE CASCADE`; platform tables never reference app tables. Platform records point at
  app records with `ref_type` + `ref_id` (e.g. an invoice for a legal matter).
- API dates: instants are ISO-8601 UTC (`…Z`), calendar days are `YYYY-MM-DD`; the web shows both in IST.

## Boundaries

Backend (`server/src/test/java/…/ArchitectureTest`):
1. The platform never depends on an app or on the server module.
2. Apps never depend on each other.
3. Only platform and server code may switch tenant scope (`Tx.system`, `Tx.asOrg`).
4. Nothing reads `System.getenv`; configuration goes through Spring properties.
5. Apps don't use SLF4J/Logback directly; they log through the platform's `Log`.

Web (`web/tests/boundaries.test.ts`): platform UI never imports an app UI; app UIs never import each other or the
registry; no database drivers; only the API client and session code read `process.env`.

## Adding an app

1. Backend: a Maven module `backend/apps/<id>` with an `AppDefinition` bean, its services/controllers under
   `/api/apps/<id>`, an auto-configuration, and migrations in `db/apps/<id>/`. Add it to `backend/pom.xml`
   modules and `backend/server/pom.xml` dependencies.
2. Web: `web/src/apps/<id>/app.ts` (`AppUi`) plus pages/actions; one entry in `web/src/registry.ts`; one-line
   route files under `web/src/app/app/...`.
No platform code changes.

## Deferred on purpose

A dynamic plugin framework (apps loaded at runtime, independent versioning) is **not** built. Revisit when
a third app has paying customers, outside developers want to build apps, or per-module selling becomes
material. Apps are already separate Maven modules discovered through auto-configuration, which keeps that
migration mechanical.
