import Link from "next/link";
import { addToQueueAction, callNextAction, delayNoticeAction, setQueueStatusAction, walkInAction } from "@/actions/queue";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AutoRefresh } from "@/components/auto-refresh";
import { QueueBadge } from "@/components/status";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { requireCtx } from "@/core/auth";
import { searchContacts } from "@/core/contacts";
import { requireModule } from "@/core/modules";
import { averageConsultMinutes } from "@/core/queue";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { ageFrom, formatTime, istDate } from "@/lib/time";

function StatusButton({ entryId, status, label, className = "btn-secondary btn-sm" }: { entryId: string; status: string; label: string; className?: string }) {
  return (
    <form action={setQueueStatusAction}>
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="status" value={status} />
      <button className={className}>{label}</button>
    </form>
  );
}

export default async function QueuePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireCtx();
  requireModule(ctx, "queue");
  const { q = "" } = await searchParams;
  const date = istDate();
  const entries = await db.queueEntry.findMany({
    where: { orgId: ctx.org.id, date },
    include: { contact: true, encounter: { select: { id: true } } },
    orderBy: { tokenNumber: "asc" },
  });
  const settings = ctx.org.settings as { avgConsultMinutes?: number };
  const avg = await averageConsultMinutes(ctx.org.id, date, settings.avgConsultMinutes ?? 8);
  const waiting = entries.filter((e) => e.status === "WAITING");
  const serving = entries.filter((e) => e.status === "IN_PROGRESS");
  const skipped = entries.filter((e) => e.status === "SKIPPED");
  const done = entries.filter((e) => e.status === "DONE");
  const matches = q ? await searchContacts(ctx, q, 8) : [];

  return (
    <>
      <AutoRefresh seconds={10} />
      <PageHeader
        title="Today's queue"
        subtitle="Updates live. Patients get their token and live status on WhatsApp."
        actions={
          <>
            <Link href={`/display/${ctx.org.slug}`} target="_blank" className="btn-secondary">📺 Waiting-room screen</Link>
            <form action={callNextAction}>
              <button className="btn-primary" disabled={waiting.length === 0}>Call next patient →</button>
            </form>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Waiting" value={waiting.length} hint={`~${waiting.length * avg} min to clear`} />
        <Stat label="With doctor" value={serving.length} />
        <Stat label="Seen today" value={done.length} />
        <Stat label="Avg consult" value={`${avg} min`} hint="from today's visits" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {serving.length > 0 && (
            <Card title="With doctor now">
              <ul className="divide-y divide-slate-100">
                {serving.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div>
                      <span className="mr-3 text-2xl font-bold text-brand-700">#{e.tokenNumber}</span>
                      <Link href={`/app/contacts/${e.contactId}`} className="font-medium hover:underline">{e.contact.name}</Link>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/app/consult?entry=${e.id}`} className="btn-primary btn-sm">Open consultation</Link>
                      <StatusButton entryId={e.id} status="DONE" label="Mark done" />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title={`Waiting (${waiting.length})`}>
            {waiting.length === 0 ? (
              <Empty>No one is waiting. Add a walk-in on the right.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr><th>Token</th><th>Patient</th><th>Arrived</th><th>Est. wait</th><th /></tr>
                  </thead>
                  <tbody>
                    {waiting.map((e, i) => {
                      const age = ageFrom(e.contact.dob);
                      return (
                        <tr key={e.id}>
                          <td className="text-lg font-bold">#{e.tokenNumber}</td>
                          <td>
                            <Link href={`/app/contacts/${e.contactId}`} className="font-medium hover:underline">{e.contact.name}</Link>
                            <div className="text-xs text-slate-500">
                              {[age !== null ? `${age}y` : null, e.contact.gender, formatPhone(e.contact.phone)].filter(Boolean).join(" · ")}
                              {e.appointmentId && " · 🗓️ appointment"}
                            </div>
                          </td>
                          <td className="whitespace-nowrap">{formatTime(e.checkedInAt)}</td>
                          <td className="whitespace-nowrap">~{(i + serving.length) * avg} min</td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <StatusButton entryId={e.id} status="IN_PROGRESS" label="Start" className="btn-primary btn-sm" />
                              <StatusButton entryId={e.id} status="SKIPPED" label="Skip" />
                              <StatusButton entryId={e.id} status="CANCELLED" label="✕" className="btn-ghost btn-sm" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {skipped.length > 0 && (
            <Card title="Skipped (not present when called)">
              <ul className="divide-y divide-slate-100">
                {skipped.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span><b>#{e.tokenNumber}</b> {e.contact.name}</span>
                    <StatusButton entryId={e.id} status="WAITING" label="Back to queue" />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {done.length > 0 && (
            <Card title={`Done (${done.length})`}>
              <ul className="divide-y divide-slate-100">
                {done.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                    <span><b>#{e.tokenNumber}</b> {e.contact.name}</span>
                    <span className="flex items-center gap-3">
                      {e.encounter ? <Link href={`/app/consult?entry=${e.id}`} className="link text-xs">View</Link> : <QueueBadge status={e.status} />}
                      <Link href={`/app/billing/new?contact=${e.contactId}`} className="link text-xs">Bill</Link>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card title="Returning patient">
            <form className="flex gap-2">
              <input name="q" defaultValue={q} placeholder="Name or mobile" className="input" aria-label="Find patient" />
              <button className="btn-secondary">Find</button>
            </form>
            {q && (
              <ul className="mt-3 divide-y divide-slate-100">
                {matches.length === 0 && <li className="py-2 text-sm text-slate-500">No match. Register below.</li>}
                {matches.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span>
                      {c.name}
                      <span className="block text-xs text-slate-500">{formatPhone(c.phone)}</span>
                    </span>
                    <form action={addToQueueAction}>
                      <input type="hidden" name="contactId" value={c.id} />
                      <button className="btn-primary btn-sm">Give token</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="New walk-in">
            <ActionForm action={walkInAction} className="space-y-3">
              <input name="name" required placeholder="Full name" className="input" aria-label="Full name" />
              <input name="phone" type="tel" required placeholder="WhatsApp mobile" className="input" aria-label="Mobile" />
              <div className="grid grid-cols-3 gap-2">
                <input name="age" type="number" min={0} max={119} placeholder="Age" className="input" aria-label="Age" />
                <select name="gender" className="input" aria-label="Gender" defaultValue="">
                  <option value="">Sex</option>
                  <option value="F">F</option>
                  <option value="M">M</option>
                  <option value="O">O</option>
                </select>
                <select name="preferredLang" className="input" aria-label="Language" defaultValue="hi">
                  <option value="hi">हिन्दी</option>
                  <option value="en">Eng</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" name="whatsappOptIn" defaultChecked className="accent-brand-600" /> Patient agrees to WhatsApp updates
              </label>
              <SubmitButton className="btn-primary w-full" pendingText="Issuing…">Issue token</SubmitButton>
            </ActionForm>
          </Card>

          <Card title="Running late?">
            <ActionForm action={delayNoticeAction} className="flex gap-2">
              <input name="minutes" type="number" min={5} max={300} defaultValue={30} className="input w-24" aria-label="Minutes late" />
              <SubmitButton className="btn-secondary flex-1" pendingText="Sending…">Notify waiting patients</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
