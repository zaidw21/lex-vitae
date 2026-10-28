# Decision log

Newest at the bottom. Each entry: what was decided, why, and what was considered and rejected.
Agents: append here whenever the founder decides something (see `AGENTS.md`).

---

## 2026-10-27 · Brief
Founder's ask: build a SaaS that can reach $1M ARR (~₹8.5 crore/yr), serving **Tier 2 local businesses
in India or schools in India**. Brainstorm before implementing. Start on a clean branch, unrelated to the
law-firm website previously in this repo (Lex Vitae, Indore).

## 2026-10-27 · Ideas considered in the first brainstorm
Constraints we agreed matter in Tier 2 India: WhatsApp-first; must make or save visible money; Hindi and
regional languages and mobile-first; sold through people and channel partners rather than paid ads; avoid
crowded categories (billing/khata: Khatabook, Vyapar, myBillBook; restaurant POS: Petpooja; storefronts: Dukaan).

| Idea | Verdict |
|---|---|
| Fee collection & dues recovery for budget private schools (WhatsApp reminders + UPI links, instalments, defaulter dashboard) | Was the initial recommendation (clear payback, sticky). Not chosen: no school contacts. |
| Admissions CRM for private schools | Good upsell to the above; parked. |
| AI teacher co-pilot (NEP/CBSE question papers, report-card remarks, Holistic Progress Card) | Easy to copy; better as an add-on. Parked. |
| **WhatsApp OPD token queue for clinics** | Runner-up, then chosen (see below). |
| Repeat-customer/loyalty engine for salons, gyms and showrooms | Crowded (Reelo, Thrivee), customers cancel at high rates. Rejected. |
| B2B dues recovery for wholesalers | Real pain but informal relationships, slow sales. Rejected. |

## 2026-10-27 · Doctors first, as a complete suite
**Decision:** focus on doctors/clinics, because the founder has connections in the medical fraternity
who can provide the first customers. It must be a **complete suite, not just a token dispenser**.
**Why it can win:** HealthPlix and Eka Care give e-prescription software free (paid for by pharma companies
or government incentives), so prescriptions alone can't be the wedge. The gap is the front desk:
queue, cash leakage by staff, patient communication, follow-ups. Suite modules defined: Smart
Queue & Appointments, lightweight patient records, fast e-Rx with Hindi instructions, Billing & Cash
Control, Follow-ups & Retention, Insights, Compliance (ABDM/ABHA, DPDP consent); later teleconsult,
pharmacy, multi-branch, inpatient care.
**Defaults taken (founder didn't object):** general physicians + paediatrics first; multi-doctor
support from day one; production-quality base with WhatsApp/payments in test mode.

## 2026-10-27 · Lawyers and premium-school suite compared
Founder floated a lawyer product or a complete school suite (like premium schools use), with the idea of
**bringing what premium players offer to everyone at lower prices and filling the gaps in their apps**.
- School suite: biggest contract value but very large build (student records, attendance, timetable,
  exams, report cards, fees, transport, payroll, learning platform, admissions), 3–9 month sales cycles
  (decisions March–June), strong incumbents (Entab, MyClassboard, Edunext, Teachmint, Toddle). **Not
  first**, unless trustees or chains are ready to buy.
- Lawyers: about 10 lakh district-court advocates underserved. Product: eCourts case tracking by CNR,
  morning cause-list alerts, Hindi client updates, AI drafting, fee tracking. Risks: eCourts data has to be
  scraped (captchas, terms-of-use risk), Bar Council advertising rules, low willingness to pay.

## 2026-10-28 · Build a platform that can host any vertical, based on traction
**Decision:** one shared core (contacts, scheduling/queue, WhatsApp messaging, billing/ledger, documents,
tasks, audit, insights) + **vertical packs** (terminology, enabled modules, fields, templates,
vertical-specific screens). Clinic pack built fully first; legal pack built lighter to prove the core
is reusable. Future candidates: CAs, diagnostic labs, coaching institutes, schools.
**Implementation choices:** Next.js 15 + TypeScript + Prisma/Postgres + Tailwind; single deployable app
(no microservices); working name **Daftar** (Hindi/Urdu for "office", easy to change); WhatsApp
behind a provider interface (`log` test mode by default, Meta Cloud API ready); money in paise; IST
everywhere; phone numbers not unique (families share numbers); DPDP consent stored per contact; every
discount/void audited (cash control is the key selling point to owners).

## 2026-10-28 · v0.1 delivered
Code is on branch `ccr-33b67057-2ylghh` of `zaidw21/lex-vitae` (clean history, unrelated to the old
website on `main`). Verified with typecheck, unit tests, production build and a browser test of 15 flows.
**Recommended next step:** demo to 3–5 doctors from the founder's network; let their feedback choose
between (a) real WhatsApp + UPI payment links or (b) the WhatsApp booking bot.

## 2026-10-28 · Context must be readable by any AI agent
**Decision:** project context lives in the repo, not in any one tool's chat history. `AGENTS.md` is the
single source of truth (read by Codex, Cursor, Copilot, Gemini CLI, Aider and others); `CLAUDE.md`,
`GEMINI.md` and `.github/copilot-instructions.md` only point to it. Agents must log decisions here
and keep `docs/STRATEGY.md` roadmap current.

## 2026-10-28 · Founder direction: rename, platform/app separation, plugins, smooth deploy, UX
**Requirements stated by the founder:**
1. The name "Daftar" sounds too Indian; buyers respond to names with a Western/European feel. Rename (choice pending).
2. Platform and clients must be separate: a doctor app or legal app is a *client* that uses the platform.
3. UX should be reviewed from an expert perspective and improved.
4. Deployment must be smooth: run the platform, pick plugins to assemble a use case; the platform should
   hardly change; plugins can be any number.
**Status:** proposal written in `docs/ARCHITECTURE-V2.md` and `docs/UX-REVIEW.md`; awaiting approval of the
name and the architecture before refactoring.

## 2026-10-28 · Name, hosting budget, UX priority
- **Name: Arcus** (Latin for "arch"), chosen by the founder from Tessera / Corvia / Arcus / Practis / Veyra.
  Rename not yet applied in code. Domain/trademark check still to do.
- **Hosting:** any cloud; cheapest possible, free to start, but there must be a working CD pipeline.
- **UX:** "decent enough for now". `docs/UX-REVIEW.md` stays as a backlog, not the next task.
- **Architecture granularity is under discussion.** The founder wants platform and domain apps kept
  separate but asked to be challenged on whether a full plugin system makes sense at this stage.

## 2026-10-28 · Platform scope includes infrastructure
**Founder clarification:** "platform" also means logging, observability, communication-channel
integrations, database integrations/drivers, etc., all provided by the platform as interfaces, libraries and
providers that apps use. Apps never talk to vendors directly.
**Agent position (pending founder confirmation):** agree, using a ports-and-adapters design (each
capability is an interface plus one real adapter plus a test fake; a second real adapter only when needed).
Standardise on Postgres instead of abstracting the database engine; use OpenTelemetry/structured logs instead of a
home-grown observability layer; enforce tenant isolation inside the platform's data layer.

## Open questions (resolve with the founder)
- Which specialties are the first pilot doctors? (affects prescription templates and default medicines)
- Domain/trademark check for "Arcus"; move code to its own repository instead of `lex-vitae`?
- Hosting choice (Indian data residency for health data) and pilot pricing (free 60 days?).
- Is the Lex Vitae law firm a warm contact for the legal pack?
