# Architecture v2: platform + plugins + apps (PROPOSED, awaiting founder approval)

Founder direction (2026-10-28): the platform and the clients must be separate. A doctor app or a legal
app is a *client* that runs on the platform. The platform should hardly ever change; plugins can be any
number; deployment must be smooth (run the platform, pick plugins, get a use case).

## Three layers

| Layer | What it is | Changes how often |
|---|---|---|
| **Platform (kernel)** | Tenancy & orgs, users/roles/auth, people (contacts + consent), billing & payments, messaging (WhatsApp/SMS), documents & files, tasks/reminders, scheduled jobs, audit log, settings, design system & app shell, **plugin host** | Rarely. Versioned, with a stable plugin API. |
| **Plugins** | Self-contained features: `queue`, `appointments`, `consultations`, `prescriptions`, `matters`, `hearings`, `fee-reminders`, `admissions`… | Any number; added independently |
| **Apps (clients)** | A manifest that assembles plugins + terminology + branding + defaults, e.g. `clinic` = queue + appointments + consultations + prescriptions + follow-ups | One file per use case |

## Plugin contract (`definePlugin`)
Each plugin is a folder `plugins/<id>/` with:
- `plugin.ts`: id, version, `requires` (other plugins / platform API version), permissions it adds,
  navigation entries, settings schema, message templates (en + hi), dashboard widgets, event
  handlers (e.g. on `invoice.paid`, `contact.created`), scheduled jobs.
- `pages/`: screens. The platform mounts them at `/app/<plugin>/...` through a single catch-all route,
  so **adding a plugin never edits platform routing**. Public pages mount at `/p/<plugin>/...`.
- `actions/`: server actions, using platform services through a `ctx` (tenant-scoped db, notify, audit, billing).
- `schema.prisma` (optional): the plugin's own tables. They hold `orgId` as a plain indexed column with
  **no relation back-references**, so the platform schema never changes. A build step assembles platform +
  enabled plugin schemas (Prisma multi-file schema) and runs migrations.
- `tests/`.

Plugins talk to each other only through platform events and declared dependencies, never by importing each other's internals.

## Apps
`apps/clinic.ts`, `apps/legal.ts`, later `apps/school.ts`:
```ts
defineApp({ id: "clinic", name: "…", plugins: ["queue", "appointments", "consultations", "prescriptions", "followups"],
  terms: { contact: "Patient", practitioner: "Doctor" }, theme: {…}, defaults: {…} })
```
At signup an org picks an app; the owner can switch extra plugins on or off from a **plugin catalog** in
Settings (stored per organization, so it's a runtime choice). An app can also run under its own brand and domain.

## Deployment
- One Docker image + `docker compose up` (app + Postgres) for local runs and simple servers; migrations run on boot; health check endpoint.
- Configuration via env: `PLUGINS=all` or a list, `APPS=clinic,legal`, `WHATSAPP_*`, `PAYMENTS_*`.
- One-command deploy to a managed host in an Indian region (health-data residency): e.g. Railway/Render/Fly
  Mumbai or AWS/GCP Mumbai; GitHub Actions runs typecheck, unit tests, build and the e2e smoke test before each deploy.
- **Honest constraint:** plugins are compiled into the build (not uploaded into a running server like
  WordPress), because running unreviewed code next to health data is a security risk. Adding a plugin = add
  its folder, CI rebuilds and redeploys automatically. Turning plugins on/off per organization needs no deploy.

## Migration from v0.1
Today's `src/core` becomes the platform; `src/verticals/clinic|legal` and their pages split into plugins
(`queue`, `appointments`, `consultations`, `prescriptions`, `matters`, `hearings`) plus two app manifests.
Data model mostly carries over (Matter moves into the `matters` plugin schema). Behaviour stays the same,
the e2e smoke test must stay green throughout, and the UX changes in `docs/UX-REVIEW.md` land on top.
