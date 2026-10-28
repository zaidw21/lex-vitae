# Arcus

**A WhatsApp-first platform for Indian practices**, with domain apps built on it:

| App | For | What it adds to the platform |
|---|---|---|
| **Arcus Clinic** | Doctors | Consultations, e-prescriptions with Hindi dosing, fee rules; uses the queue + appointments modules |
| **Arcus Legal** | Advocates | Matters (case no., CNR, court, stage), hearing diary, client updates after each hearing |

Every app gets the platform for free: sign-in and roles, contacts with DPDP consent, billing with cash control
(day book, audited discounts and voids), follow-ups, WhatsApp messaging in Hindi/English, documents, dashboard,
audit log, tenant isolation, logging and error reporting.

> **Working on this repo (people or AI agents)?** Start with [`AGENTS.md`](AGENTS.md), then
> [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/DECISIONS.md`](docs/DECISIONS.md) and
> [`docs/STRATEGY.md`](docs/STRATEGY.md).

## Run it

**With Docker** (nothing else needed):

```sh
docker compose up --build        # http://localhost:3000 (migrations run automatically)
docker compose run --rm seed     # optional demo data
```

**Without Docker** (Node 22 + Postgres 14+):

```sh
cp .env.example .env             # set DATABASE_URL
npm install
npx prisma migrate deploy
npm run db:seed                  # optional demo data
npm run dev
```

Demo logins (password `demo1234`):
- `demo@example.com`: owner of *Sharma Family Clinic* (Arcus Clinic) and *Verma & Associates* (Arcus Legal)
- `reception@example.com`: front-desk staff at the clinic

Checks: `npm run typecheck`, `npm test` (needs the database), `npm run build`, `npm run e2e`
(browser test against a running, freshly seeded app; install Playwright first with
`npm i --no-save playwright && npx playwright install chromium`). CI runs all of them on every push.

## Configuration

All settings are environment variables, validated in `src/platform/kernel/config.ts`; see `.env.example`.

- `WHATSAPP_PROVIDER=log` (default) records every message in the WhatsApp outbox without sending, so the
  product can be demoed without accounts. `meta` sends through the WhatsApp Business Cloud API
  (`META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID`). Before going live, business-initiated messages must use
  Meta-approved templates (see the roadmap).
- Logs are JSON lines on stdout/stderr (Google Cloud Logging format); errors are written in Cloud Error
  Reporting format. `GET /api/health` checks the app and database.

## Status

v0.2. See the roadmap and open items (CD pipeline, repo move, UX track) in `docs/STRATEGY.md`.
