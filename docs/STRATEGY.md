# Arcus: strategy notes

## Thesis
Big hospitals and law firms have queue systems, digital records, billing controls and automated follow-ups.
Most Indian practices in Tier 2 and 3 cities run on paper registers and the owner's phone. Arcus brings
the premium toolkit to every practice at ₹999–5,999/month, delivered where their patients and clients
already are: **WhatsApp**.

**Platform, not point product.** Most of what a practice needs is the same everywhere: people, scheduling,
WhatsApp, billing, follow-ups, documents. Only terminology and a few workflows differ. Each new
profession is a *vertical pack* on the same core, so we can follow traction.

## Why clinics first
- Founder has warm access to doctors, and early pilots matter more than features.
- Daily, all-day use (sticky) and clear return on investment:
  - Cash leakage at the front desk: day book + audit log.
  - Lost repeat visits: follow-up reminders.
  - Waiting-room chaos: live tokens.
- Free prescription tools (HealthPlix, Eka) prove doctors go digital, but they ignore the front desk and
  cash, which is exactly our wedge. We don't compete on Rx alone.

## Pricing (monthly, GST extra)
| Plan | Price | For |
|---|---|---|
| Starter | ₹999 | Queue/diary, WhatsApp, billing, 2 users |
| Pro | ₹2,499 | + prescriptions/records, follow-up automation, insights, audit |
| Clinic+ | ₹5,999 | Multi-practitioner, multiple counters |

WhatsApp conversation charges passed through at cost. **$1M ARR ≈ 4,000 practices at ~₹1,800 ARPU.**

## Go-to-market
1. 10 pilot clinics through the founder's network, free for 60 days in return for weekly feedback.
2. Convert to paid; collect "₹X more collected / Y fewer no-shows" case studies.
3. Expand through referrals: doctor-to-doctor, local IMA chapters, medical reps, pharmacy distributors.
   Every patient who sees the token link is also a marketing touch.
4. Add the legal pack using bar association contacts; then CAs / labs / coaching based on demand.

## Roadmap
**Done**
- v0.1 (2026-10-28): platform core + clinic and legal packs, demo seed, tests.
- v0.2 (2026-10-28): renamed to Arcus; platform/app separation with enforced boundaries; tenant-scoped
  database; platform telemetry; messaging ports/adapters; module switches per organization; Docker; CI.

**Next: go-live with pilot clinics**
- WhatsApp approved templates + Meta onboarding; delivery/read webhooks
- Phone OTP login (over WhatsApp); password reset
- Scheduled jobs: morning follow-up reminders, "turn near" nudges, chronic refill reminders
- Razorpay/Cashfree UPI payment links on bills; auto-reconcile

**Next: UX (from `docs/UX-REVIEW.md`, in priority order)**
1. Role-based home screens: front desk (find/register → token → collect fee), doctor (current + next
   patient only), owner (money, dues, no-shows, staff activity)
2. Fee collection at check-in as the default (configurable); doctors never handle money
3. Global search on every screen (phone or name, `/` shortcut) showing all family members on a shared number
4. Two-pane consultation screen: patient context left, keyboard-first prescription right; vitals entered by reception
5. Hindi UI toggle (patient-facing text is already bilingual)
6. Mobile card layouts instead of tables; 44px touch targets
7. First-run setup checklist (letterhead/logo, fees, invite reception, connect WhatsApp, TV screen)
8. Undo toasts instead of instant destructive actions
9. Owner dashboard: expected vs collected, dues and no-shows first; nightly WhatsApp summary to the owner
10. Visual polish: icon set instead of emoji, type scale, Arcus brand colours; A5 prescriptions and thermal receipts;
    loading/offline states; accessibility pass
Validate 1–4 with 3 receptionists and 3 doctors from the pilots (targets: walk-in token < 20 s,
repeat-patient prescription < 45 s).

**Then**
- WhatsApp bot: patients book a token/appointment by messaging the clinic
- Voice dictation → AI-structured prescription
- ABDM/ABHA linking (DHIS incentives); lab report upload
- Legal: eCourts sync by CNR, cause-list alerts, AI drafting (notices, bail applications) in Hindi/English
- Multi-branch, pharmacy stock, IPD for nursing homes
- Dynamic plugin framework (only when a third app has traction; see `docs/ARCHITECTURE.md`)

**Open items**
- **CD pipeline** (founder will set up later): Google Cloud Run (Mumbai) + Supabase Postgres (Mumbai), deploy
  from GitHub Actions on merge to `main`. CI is already in place. Needs: GCP project with billing, Supabase project,
  secrets in GitHub (`DATABASE_URL`, `APP_URL`, GCP service-account key).
- **Move to the `zaidw21/arcus` repository**: the founder creates the empty repo (the agent cannot create
  repositories), then the history is pushed there.
- Domain + trademark check for "Arcus".
- SMS (TRAI DLT registration): not needed for now; OTP will go over WhatsApp.
- Organization deletion flow with per-app cleanup hooks (app tables don't cascade).

## Risks
- Low willingness to pay → anchor on cash recovered and repeat visits, not features.
- WhatsApp policy/pricing changes → keep messaging behind a provider interface (done); SMS fallback.
- Health data → DPDP consent recorded per contact (done); encryption at rest, data residency in India, breach process before scale.
