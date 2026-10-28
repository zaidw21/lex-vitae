import Link from "next/link";
import { Logo } from "@/platform/ui/logo";

const CLINIC_FEATURES = [
  ["Live OPD queue", "Walk-ins and appointments in one queue. Patients get their token on WhatsApp and track it live, so the waiting room stays calm."],
  ["2-minute e-prescriptions", "Favourite medicines, one-tap doses, and instructions in Hindi (\"सुबह 1, रात 1 · खाने के बाद\"), printed on your letterhead and sent on WhatsApp."],
  ["Billing with cash control", "Every receipt, discount and void is logged with who did it. A day book shows cash vs UPI at closing time."],
  ["Follow-ups that bring patients back", "Set \"review in 7 days\" and Arcus reminds the patient. Repeat medicine reminders for diabetes and BP patients."],
];

const LEGAL_FEATURES = [
  ["Hearing diary", "Every matter's next date in one diary, with today's board ready each morning."],
  ["Client updates in Hindi", "Record what happened in court and the client gets a WhatsApp update with the next date, so there are no more \"what happened today?\" calls."],
  ["Matters & fees", "Case number, CNR, court and stage per matter, with fee ledger and receipts per client."],
];

const PLANS = [
  { name: "Starter", price: "₹999", desc: "Solo practice", items: ["Queue / diary", "WhatsApp updates", "Billing & receipts", "1 practitioner + 1 staff"] },
  { name: "Pro", price: "₹2,499", desc: "Most popular", items: ["Everything in Starter", "Prescriptions & records", "Follow-up automation", "Insights & audit log"], featured: true },
  { name: "Clinic+", price: "₹5,999", desc: "Multi-doctor clinics & firms", items: ["Everything in Pro", "Up to 10 practitioners", "Multiple counters", "Priority onboarding"] },
];

export default function Landing() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start free trial
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-4 pb-16 pt-10 text-center sm:pt-16">
        <p className="mx-auto mb-4 inline-block rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
          Made for clinics and chambers in Tier 2 India
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Run your whole practice on WhatsApp. <span className="text-brand-600">Without the chaos.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Arcus brings the tools big hospitals and law firms use (queues, digital records, billing controls and automated
          follow-ups) to every practice, at a price that makes sense.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Start 30-day free trial
          </Link>
          <Link href="/login" className="btn-secondary px-6 py-3 text-base">
            See the demo
          </Link>
        </div>
        <p className="mt-3 text-xs text-slate-500">Demo login: demo@example.com / demo1234</p>
      </section>

      <section className="border-y border-slate-100 bg-slate-50 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold">Arcus Clinic <span className="text-base font-normal text-slate-500">for doctors</span></h2>
            <div className="mt-6 space-y-5">
              {CLINIC_FEATURES.map(([t, d]) => (
                <div key={t}>
                  <h3 className="font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-slate-600">{d}</p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-semibold">Arcus Legal <span className="text-base font-normal text-slate-500">for advocates</span></h2>
            <div className="mt-6 space-y-5">
              {LEGAL_FEATURES.map(([t, d]) => (
                <div key={t}>
                  <h3 className="font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-slate-600">{d}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 text-sm text-slate-500">More professions coming: CAs, coaching institutes, diagnostic labs.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-center text-2xl font-semibold">Simple monthly pricing</h2>
        <p className="mt-2 text-center text-sm text-slate-500">GST extra. WhatsApp message charges billed at cost.</p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`card p-6 ${p.featured ? "border-brand-500 ring-2 ring-brand-500/20" : ""}`}>
              <div className="text-sm font-semibold text-brand-700">{p.desc}</div>
              <div className="mt-1 text-xl font-semibold">{p.name}</div>
              <div className="mt-4 text-3xl font-bold">
                {p.price}
                <span className="text-base font-normal text-slate-500">/month</span>
              </div>
              <ul className="mt-5 space-y-2 text-sm text-slate-600">
                {p.items.map((i) => (
                  <li key={i}>✓ {i}</li>
                ))}
              </ul>
              <Link href="/signup" className={`mt-6 w-full ${p.featured ? "btn-primary" : "btn-secondary"}`}>
                Start free trial
              </Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Arcus
      </footer>
    </div>
  );
}
