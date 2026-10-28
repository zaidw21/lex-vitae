import Link from "next/link";
import { notFound } from "next/navigation";
import { recordHearingAction, setMatterStatusAction } from "@/actions/matters";
import { createTaskAction } from "@/actions/tasks";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { InvoiceBadge, TaskBadge } from "@/components/status";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { requireCtx } from "@/core/auth";
import { requireModule } from "@/core/modules";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { addDays, formatDate, istDate, toDateInput } from "@/lib/time";
import { MATTER_STAGES } from "@/verticals/legal";

export default async function MatterPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  requireModule(ctx, "matters");
  const matter = await db.matter.findFirst({
    where: { id: (await params).id, orgId: ctx.org.id },
    include: {
      contact: true,
      encounters: { orderBy: { occurredAt: "desc" } },
      invoices: { orderBy: { createdAt: "desc" } },
      tasks: { orderBy: { dueOn: "asc" } },
    },
  });
  if (!matter) notFound();
  const today = istDate();
  const fees = matter.invoices.filter((i) => i.status !== "VOID");
  const billed = fees.reduce((s, i) => s + i.total, 0);
  const received = fees.reduce((s, i) => s + i.paid, 0);

  return (
    <>
      <PageHeader
        title={matter.title}
        subtitle={[matter.caseType, matter.caseNumber, matter.court].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/app/billing/new?contact=${matter.contactId}&matter=${matter.id}`} className="btn-secondary">New fee bill</Link>
            <form action={setMatterStatusAction}>
              <input type="hidden" name="id" value={matter.id} />
              <input type="hidden" name="status" value={matter.status === "OPEN" ? "CLOSED" : "OPEN"} />
              <button className="btn-ghost">{matter.status === "OPEN" ? "Close matter" : "Reopen"}</button>
            </form>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Record today's hearing">
            <ActionForm action={recordHearingAction} className="space-y-3">
              <input type="hidden" name="matterId" value={matter.id} />
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="heldOn">Hearing date</label>
                  <input id="heldOn" name="heldOn" type="date" required defaultValue={toDateInput(matter.nextHearingOn && matter.nextHearingOn <= today ? matter.nextHearingOn : today)} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="purpose">Listed for</label>
                  <input id="purpose" name="purpose" className="input" placeholder="Evidence" />
                </div>
                <div>
                  <label className="label" htmlFor="stage">Stage now</label>
                  <select id="stage" name="stage" defaultValue={matter.stage ?? ""} className="input">
                    {MATTER_STAGES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="outcome">What happened</label>
                <textarea id="outcome" name="outcome" required rows={2} className="input" placeholder="PW-1 examined; cross-examination deferred at request of opposite counsel." />
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <label className="label" htmlFor="nextDate">Next date</label>
                  <input id="nextDate" name="nextDate" type="date" className="input" defaultValue={toDateInput(addDays(today, 30))} />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" name="notifyClient" defaultChecked={matter.contact.whatsappOptIn} className="accent-brand-600" />
                  Send update to client on WhatsApp
                </label>
              </div>
              <SubmitButton>Save hearing</SubmitButton>
            </ActionForm>
          </Card>
          <Card title={`Hearing history (${matter.encounters.length})`}>
            {matter.encounters.length === 0 ? (
              <Empty>No hearings recorded yet.</Empty>
            ) : (
              <ol className="relative space-y-4 border-l border-slate-200 pl-4">
                {matter.encounters.map((e) => {
                  const d = e.data as { purpose?: string; outcome?: string; stage?: string; nextDate?: string | null };
                  return (
                    <li key={e.id}>
                      <div className="text-sm font-semibold">{formatDate(e.occurredAt)} {d.purpose && <span className="font-normal text-slate-500">· {d.purpose}</span>}</div>
                      <p className="text-sm text-slate-700">{d.outcome}</p>
                      <div className="text-xs text-slate-500">
                        {d.stage && `Stage: ${d.stage}`} {d.nextDate && `· Next: ${formatDate(new Date(d.nextDate))}`}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Details">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Client</dt><dd><Link href={`/app/contacts/${matter.contactId}`} className="link">{matter.contact.name}</Link></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Mobile</dt><dd>{formatPhone(matter.contact.phone)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Opposite party</dt><dd className="text-right">{matter.oppositeParty ?? "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">CNR</dt><dd className="font-mono text-xs">{matter.cnr ?? "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Stage</dt><dd>{matter.stage ?? "—"}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Next date</dt><dd><Badge tone={matter.nextHearingOn && matter.nextHearingOn >= today ? "blue" : "red"}>{formatDate(matter.nextHearingOn)}</Badge></dd></div>
              <div className="flex justify-between gap-2"><dt className="text-slate-500">Status</dt><dd>{matter.status === "OPEN" ? <Badge tone="green">Open</Badge> : <Badge>Closed</Badge>}</dd></div>
            </dl>
          </Card>
          <Card title="Fees">
            <div className="mb-3 flex justify-between text-sm">
              <span>Billed {formatMoney(billed)}</span>
              <span className={billed > received ? "font-semibold text-red-700" : "text-emerald-700"}>Due {formatMoney(billed - received)}</span>
            </div>
            <ul className="space-y-1 text-sm">
              {matter.invoices.map((i) => (
                <li key={i.id} className="flex justify-between">
                  <Link href={`/app/billing/${i.id}`} className="link">#{i.number} · {formatMoney(i.total)}</Link>
                  <InvoiceBadge status={i.status} />
                </li>
              ))}
            </ul>
          </Card>
          <Card title="To-dos">
            <ul className="mb-3 space-y-1 text-sm">
              {matter.tasks.map((t) => (
                <li key={t.id} className="flex justify-between gap-2"><span>{t.title} · {formatDate(t.dueOn)}</span><TaskBadge status={t.status} /></li>
              ))}
            </ul>
            <ActionForm action={createTaskAction} className="space-y-2">
              <input type="hidden" name="matterId" value={matter.id} />
              <input type="hidden" name="contactId" value={matter.contactId} />
              <input name="title" required placeholder="e.g. File written statement" className="input" aria-label="To-do" />
              <input name="dueOn" type="date" required defaultValue={toDateInput(addDays(today, 7))} className="input" aria-label="Due" />
              <SubmitButton className="btn-secondary w-full">Add to-do</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
