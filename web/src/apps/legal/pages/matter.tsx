import Link from "next/link";
import { recordHearingAction, setMatterStatusAction } from "../actions";
import { createTaskAction } from "@/platform/actions/tasks";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { InvoiceBadge, TaskBadge } from "@/platform/ui/status";
import { Badge, Card, Empty, PageHeader } from "@/platform/ui/ui";
import { api } from "@/platform/api/client";
import { load, requireCtx } from "@/platform/kernel/auth";
import { requireApp } from "@/platform/kernel/modules";
import { formatMoney } from "@/platform/lib/money";
import { formatPhone } from "@/platform/lib/phone";
import { addDays, formatDate, todayIst } from "@/platform/lib/time";
import type { MatterView, Options } from "../types";

export default async function MatterPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  requireApp(ctx, "legal");
  const id = encodeURIComponent((await params).id);
  const [view, options] = await Promise.all([
    load(api.get<MatterView>(`/api/apps/legal/matters/${id}`)),
    api.get<Options>("/api/apps/legal/options"),
  ]);
  const matter = { ...view.matter, contact: { name: view.matter.clientName, phone: view.matter.clientPhone }, encounters: view.hearings, invoices: view.invoices, tasks: view.tasks };
  const today = todayIst();
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
            <Link href={`/app/billing/new?contact=${matter.contactId}&refType=matter&refId=${matter.id}&refLabel=${encodeURIComponent(matter.title)}`} className="btn-secondary">New fee bill</Link>
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
                  <input id="heldOn" name="heldOn" type="date" required defaultValue={matter.nextHearingOn && matter.nextHearingOn <= today ? matter.nextHearingOn : today} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="purpose">Listed for</label>
                  <input id="purpose" name="purpose" className="input" placeholder="Evidence" />
                </div>
                <div>
                  <label className="label" htmlFor="stage">Stage now</label>
                  <select id="stage" name="stage" defaultValue={matter.stage ?? ""} className="input">
                    {options.stages.map((s) => <option key={s}>{s}</option>)}
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
                  <input id="nextDate" name="nextDate" type="date" className="input" defaultValue={addDays(today, 30)} />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" name="notifyClient" defaultChecked className="accent-brand-600" />
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
                        {d.stage && `Stage: ${d.stage}`} {d.nextDate && `· Next: ${formatDate(d.nextDate)}`}
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
              <input type="hidden" name="refType" value="matter" />
              <input type="hidden" name="refId" value={matter.id} />
              <input type="hidden" name="contactId" value={matter.contactId} />
              <input name="title" required placeholder="e.g. File written statement" className="input" aria-label="To-do" />
              <input name="dueOn" type="date" required defaultValue={addDays(today, 7)} className="input" aria-label="Due" />
              <SubmitButton className="btn-secondary w-full">Add to-do</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
