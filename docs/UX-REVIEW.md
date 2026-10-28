# UX review of v0.1 (2026-10-28)

Reviewed from the perspective of the people who actually use a Tier 2 clinic: a receptionist on a cheap
Android phone or old desktop, a doctor seeing 60–100 patients a day, and an owner who checks money at night.
Ordered by impact.

## Critical
1. **One app for three different jobs.** Reception, doctor and owner see the same module-based navigation.
   → Role-based home screens: *Front desk* (find/register → token → collect fee), *Doctor* (current patient +
   next, nothing else), *Owner* (money, dues, no-shows, staff activity).
2. **Fee collection is in the wrong place.** Most Indian clinics collect the fee at registration, not after
   the consultation. Billing currently sits at the end of the doctor's screen.
   → Make "collect at check-in" the default, configurable per clinic; the doctor never touches money.
3. **Finding a patient is the most frequent action and it's buried.** → Global search on every screen
   (phone or name, keyboard shortcut `/`), showing all **family members on a shared number** with one-tap
   "give token".
4. **The doctor's consultation screen is a long form.** The prescription (the core output) is below vitals and notes.
   → Two-pane layout: left = patient context (allergies, conditions, last visit, last Rx); right =
   Rx-first, keyboard-driven entry (type 3 letters → favourite → Enter), with vitals entered by reception before the doctor sees the patient.

## Major
5. **Hindi UI.** Patient-facing text is bilingual but receptionists use the app in English. → Full UI language toggle (Hindi/English).
6. **Mobile tables.** The waiting list wraps phone numbers over 4 lines at 390px. → Card layout on small screens; 44px touch targets (current small buttons ~28px).
7. **First-run experience.** A new clinic lands on an empty dashboard. → Setup checklist: letterhead &
   logo, fees, invite reception, connect WhatsApp, open the TV screen, add first patient; sample data toggle.
8. **Destructive actions without confirmation or undo** (cancel token ✕, remove staff). → Undo toast for 5s; confirm only for irreversible actions.
9. **Owner dashboard priorities.** "Busiest hours" takes the top slot; owners care first about cash vs expected,
   dues and no-shows. → Reorder; add "expected vs collected" and a nightly WhatsApp summary to the owner.

## Polish
10. **Brand & visual quality.** Emoji icons in the navigation and a generic green look home-made. → Proper icon set,
    a designed colour system and type scale, consistent spacing, product logo. (Pairs with the rename.)
11. **Print.** Offer A5 prescriptions (common in clinics), custom letterhead/logo, and receipt sizes for thermal printers.
12. **Feedback states.** Loading skeletons on the live queue, an offline banner (patchy internet), and success toasts instead of inline boxes.
13. **Accessibility.** Some 10–12px text; colour-only status in places. → Minimum 13px body on dense screens, status chips with text (mostly done), focus states on every control.

## Validate with users
Test the redesigned flows with 3 receptionists and 3 doctors from the pilot clinics before finalising:
time-to-token for a walk-in (target < 20 s) and time-to-prescription for a repeat patient (target < 45 s).
