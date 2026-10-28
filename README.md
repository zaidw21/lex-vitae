# Daftar

**A WhatsApp-first practice OS for Indian professionals.** One platform core, with a *vertical pack*
per profession. It ships with two packs:

| Pack | What it does |
|---|---|
| 🩺 **Clinic** (full) | Live OPD token queue + waiting-room TV + patient status link · e-prescriptions with Hindi dosing instructions · consultation billing · follow-up reminders |
| ⚖️ **Law practice** | Matters (case no., CNR, court, stage) · hearing diary grouped by court · "needs a date" alerts · client updates on WhatsApp after each hearing |

Shared by every pack: contacts with DPDP consent, appointments, billing with **cash control** (day book by
staff member, every discount and void audited), follow-ups, WhatsApp outbox, team roles, audit log,
insights dashboard, multiple practices per login.

## Run it locally

Needs Node 20+ and Postgres 14+.

```sh
cp .env.example .env          # set DATABASE_URL
npm install
npx prisma migrate deploy     # create tables
npm run db:seed               # demo clinic + demo law chamber
npm run dev                   # http://localhost:3000
```

Demo logins (password `demo1234`):
- `demo@daftar.in`: owner of *Sharma Family Clinic* and *Verma & Associates* (switch at top-left)
- `reception@daftar.in`: front-desk staff at the clinic

Checks: `npm run typecheck`, `npm test`, `npm run build`.

## Architecture

```
prisma/schema.prisma     one data model for every vertical
src/core/                platform services: auth & sessions, queue, billing, messaging, audit, insights
src/verticals/           vertical packs
  types.ts               the VerticalPack contract
  clinic/                terminology, modules, contact fields, message templates, Rx + consultation logic
  legal/                 terminology, modules, matters + hearing logic
src/actions/             server actions (all writes go through here; every query is scoped by orgId)
src/app/app/             the signed-in product
src/app/{t,d,r,display}  public pages: token status, documents, receipts, waiting-room TV
```

**Multi-tenancy.** Every row carries `orgId`. Pages and actions get the organization from the session
(`requireCtx()`), never from the URL, and every lookup filters on it. Public pages use unguessable
`publicCode`s and show only what that link is for (the TV display shows token numbers, never names).

**Adding a vertical** (e.g. CA firms, diagnostic labs, coaching institutes):
1. Add the enum value to `Vertical` in `prisma/schema.prisma` and migrate.
2. Create `src/verticals/<name>/index.ts` implementing `VerticalPack`: terms ("Student", "Batch"…),
   which modules it enables, extra contact fields, default services, WhatsApp templates in English and Hindi.
3. Register it in `src/verticals/index.ts`. Signup, navigation, contacts, billing, follow-ups and
   messaging work immediately; add pages under `src/app/app/` only for what is truly unique to it.

**Money** is integer paise. **Dates**: "today" is always the IST day (`src/lib/time.ts`).

## WhatsApp

`WHATSAPP_PROVIDER=log` (default) records every message in the WhatsApp outbox without sending, so the
whole product can be demoed without an account. `WHATSAPP_PROVIDER=meta` sends through the WhatsApp
Business Cloud API using `META_WA_TOKEN` and `META_WA_PHONE_NUMBER_ID`.

Before going live: Meta only allows free-form text to people who messaged the business in the last
24 hours. Token, reminder, receipt and hearing-update messages are business-initiated, so each template
in the vertical packs must be registered as an approved **utility template** and sent by template name.
That is the next step for `src/core/messaging.ts`.

## Not built yet

See `docs/STRATEGY.md` for the roadmap. Notably: payment links (Razorpay/Cashfree UPI), WhatsApp booking
bot, OTP login, scheduled jobs (automatic morning reminders; today they're one click), ABDM/ABHA,
voice-to-prescription, eCourts sync by CNR, and a Hindi UI (patient/client-facing text is already bilingual).
