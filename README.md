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

## How it's built

```
web/      Next.js UI (TypeScript), no business logic ──HTTP──►  backend/  Java 21 + Spring Boot 4 API ──► Postgres 16
```

The Java API holds every business rule, the tenant isolation (Postgres row-level security), messaging and
telemetry. Apps (`backend/apps/clinic`, `backend/apps/legal`) are separate Maven modules on the shared platform.

## Run it

**With Docker** (nothing else needed):

```sh
docker compose up --build        # web on http://localhost:3000, API on :8080 (migrations run automatically)
docker compose run --rm seed     # optional demo data
```

**Without Docker** (Java 21, Node 22, Postgres 14+):

```sh
psql -U postgres -f deploy/postgres-init.sql     # an ordinary role + database "arcus"

cd backend
./mvnw -B package -DskipTests
java -jar server/target/arcus-server.jar --spring.profiles.active=seed   # optional demo data
java -jar server/target/arcus-server.jar         # API on :8080

cd ../web
cp .env.example .env && npm install && npm run dev   # http://localhost:3000
```

Demo logins (password `demo1234`):
- `demo@example.com`: owner of *Sharma Family Clinic* (Arcus Clinic) and *Verma & Associates* (Arcus Legal)
- `reception@example.com`: front-desk staff at the clinic

Checks: `./mvnw -B verify` in `backend/` (needs Docker for Testcontainers, or `ARCUS_TEST_DB_URL`); in `web/`:
`npm run typecheck`, `npm test`, `npm run build`, and `npm run e2e` (browser test against a running, freshly seeded
api + web; install Playwright first with `npm i --no-save playwright && npx playwright install chromium`).
CI runs all of them on every push.

## Configuration

API settings are environment variables mapped in `backend/server/src/main/resources/application.yml`:
`DATABASE_URL` (JDBC), `DATABASE_USER`, `DATABASE_PASSWORD`, `PORT`, `APP_URL` (public web URL used in WhatsApp
links), `WHATSAPP_PROVIDER`, `META_WA_TOKEN`, `META_WA_PHONE_NUMBER_ID`, `LOG_LEVEL`, `LOG_FORMAT`.
The web needs only `API_URL`.

- `WHATSAPP_PROVIDER=log` (default) records every message in the WhatsApp outbox without sending, so the
  product can be demoed without accounts. `meta` sends through the WhatsApp Business Cloud API. Before going
  live, business-initiated messages must use Meta-approved templates (see the roadmap).
- Logs are JSON lines in Google Cloud Logging format; errors carry stack traces in Cloud Error Reporting
  format. `GET /actuator/health` checks the API and database.
- The API's database role must not be a superuser or have BYPASSRLS; the API refuses to start otherwise.

## Status

v0.3. See the roadmap and open items (CD pipeline, repo move, UX track) in `docs/STRATEGY.md`.
