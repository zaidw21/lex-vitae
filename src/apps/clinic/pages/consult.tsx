import Link from "next/link";
import { notFound } from "next/navigation";
import { saveConsultationAction } from "../actions";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { RxEditor } from "../components/rx-editor";
import { Badge, Card, PageHeader } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { requireApp } from "@/platform/kernel/modules";
import { paiseToRupees } from "@/platform/lib/money";
import { formatPhone } from "@/platform/lib/phone";
import { ageFrom, formatDate } from "@/platform/lib/time";
import { suggestedFee } from "../consultation";
import { sanitizeRxItems, type RxItem } from "../rx";

const VITALS = [
  ["bp", "BP", "120/80"],
  ["pulse", "Pulse", "/min"],
  ["temp", "Temp", "°F"],
  ["spo2", "SpO₂", "%"],
  ["weight", "Weight", "kg"],
  ["sugar", "Sugar", "mg/dL"],
] as const;

export default async function ConsultPage({ searchParams }: { searchParams: Promise<{ entry?: string; contact?: string }> }) {
  const ctx = await requireCtx();
  requireApp(ctx, "clinic");
  const { entry: entryId, contact: contactParam } = await searchParams;

  const entry = entryId
    ? await ctx.db.queueEntry.findFirst({ where: { id: entryId }, include: { encounter: { include: { documents: true } } } })
    : null;
  const contactId = entry?.contactId ?? contactParam;
  if (!contactId) notFound();
  const contact = await ctx.db.contact.findFirst({ where: { id: contactId } });
  if (!contact) notFound();

  // Already completed from the queue: go straight to its prescription.
  const existingDoc = entry?.encounter?.documents[0];
  if (existingDoc) {
    return (
      <>
        <PageHeader title={`Token #${entry!.tokenNumber}: ${contact.name}`} />
        <Card>
          <p className="text-sm">This consultation is saved.</p>
          <div className="mt-3 flex gap-2">
            <Link href={`/app/documents/${existingDoc.id}`} className="btn-primary">Open prescription</Link>
            <Link href="/app/queue" className="btn-secondary">Back to queue</Link>
          </div>
        </Card>
      </>
    );
  }

  const [history, favourites, fee] = await Promise.all([
    ctx.db.encounter.findMany({
      where: { contactId: contact.id, kind: "CONSULTATION" },
      orderBy: { occurredAt: "desc" },
      take: 5,
      include: { documents: true },
    }),
    ctx.db.catalogItem.findMany({ where: { kind: "MEDICINE", active: true }, orderBy: { name: "asc" } }),
    suggestedFee(ctx, contact.id),
  ]);
  const favouriteItems: RxItem[] = sanitizeRxItems(favourites.map((f) => ({ name: f.name, ...(f.data as object) })));
  const lastRx = history.find((h) => h.documents.length > 0)?.documents[0];
  const previous = lastRx ? sanitizeRxItems((lastRx.data as { items?: unknown }).items) : [];
  const fields = contact.fields as Record<string, string>;
  const age = ageFrom(contact.dob);

  return (
    <>
      <PageHeader
        title={entry ? `Token #${entry.tokenNumber}: ${contact.name}` : contact.name}
        subtitle={[age !== null ? `${age} yrs` : null, contact.gender, formatPhone(contact.phone)].filter(Boolean).join(" · ")}
        actions={<Link href={`/app/contacts/${contact.id}`} className="btn-ghost">Full history →</Link>}
      />
      {(fields.allergies || fields.conditions) && (
        <div className="mb-4 flex flex-wrap gap-2">
          {fields.allergies && <Badge tone="red">⚠ Allergies: {fields.allergies}</Badge>}
          {fields.conditions && <Badge tone="amber">{fields.conditions}</Badge>}
        </div>
      )}
      <ActionForm action={saveConsultationAction}>
        <input type="hidden" name="contactId" value={contact.id} />
        {entry && <input type="hidden" name="entryId" value={entry.id} />}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card title="Vitals">
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {VITALS.map(([key, label, ph]) => (
                  <div key={key}>
                    <label className="label text-xs" htmlFor={key}>{label}</label>
                    <input id={key} name={key} placeholder={ph} className="input" />
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Notes">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="complaints">Complaints</label>
                  <textarea id="complaints" name="complaints" rows={2} className="input" placeholder="Fever x 3 days, body ache" />
                </div>
                <div>
                  <label className="label" htmlFor="findings">Examination</label>
                  <textarea id="findings" name="findings" rows={2} className="input" placeholder="Throat congested, chest clear" />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="diagnosis">Diagnosis</label>
                  <input id="diagnosis" name="diagnosis" className="input" placeholder="Acute viral fever" />
                </div>
              </div>
            </Card>
            <Card title="Prescription (℞)">
              <RxEditor favourites={favouriteItems} previous={previous} />
              <div className="mt-4">
                <label className="label" htmlFor="advice">Advice</label>
                <textarea id="advice" name="advice" rows={2} className="input" placeholder="Plenty of fluids. CBC if fever persists beyond 3 days." />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Finish">
              <fieldset>
                <legend className="label">Follow-up</legend>
                <div className="flex flex-wrap gap-2">
                  {[["", "None"], ["3", "3 d"], ["5", "5 d"], ["7", "1 wk"], ["15", "15 d"], ["30", "1 mo"]].map(([v, l]) => (
                    <label key={v} className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                      <input type="radio" name="followUpDays" value={v} defaultChecked={v === ""} className="sr-only" /> {l}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" name="bill" defaultChecked className="accent-brand-600" /> Bill consultation fee
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm">₹</span>
                  <input name="fee" type="number" min={0} defaultValue={paiseToRupees(fee.amount)} className="input w-28" aria-label="Fee" />
                  <span className="text-xs text-slate-500">{fee.reason}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 text-sm">
                  {[["CASH", "Cash"], ["UPI", "UPI"], ["CARD", "Card"], ["", "Pay later"]].map(([v, l]) => (
                    <label key={v} className="flex items-center gap-1">
                      <input type="radio" name="paymentMode" value={v} defaultChecked={v === "CASH"} className="accent-brand-600" /> {l}
                    </label>
                  ))}
                </div>
              </div>
              <label className="mt-4 flex items-center gap-2 text-sm">
                <input type="checkbox" name="sendWhatsApp" defaultChecked={contact.whatsappOptIn} className="accent-brand-600" />
                Send prescription on WhatsApp
              </label>
              <SubmitButton className="btn-primary mt-4 w-full py-3" pendingText="Saving…">Save & print prescription</SubmitButton>
            </Card>

            <Card title="Previous visits">
              {history.length === 0 ? (
                <p className="text-sm text-slate-500">First visit.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {history.map((h) => {
                    const d = h.data as { complaints?: string; diagnosis?: string };
                    return (
                      <li key={h.id} className="border-b border-slate-100 pb-2 last:border-0">
                        <div className="font-medium">{formatDate(h.occurredAt)}</div>
                        <div className="text-slate-600">{d.diagnosis || d.complaints || "—"}</div>
                        {h.documents[0] && <Link href={`/app/documents/${h.documents[0].id}`} className="link text-xs">View Rx</Link>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </ActionForm>
    </>
  );
}
