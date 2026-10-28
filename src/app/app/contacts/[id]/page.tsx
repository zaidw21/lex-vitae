import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceBadge, MessageBadge, TaskBadge } from "@/platform/ui/status";
import { Badge, Card, Empty, PageHeader } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { findContact } from "@/platform/services/contacts";
import { extensions } from "@/platform/kernel/modules";
import { formatMoney } from "@/platform/lib/money";
import { formatPhone } from "@/platform/lib/phone";
import { ageFrom, formatDate, formatDateTime } from "@/platform/lib/time";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const contact = await findContact(ctx, (await params).id);
  if (!contact) notFound();
  const where = { contactId: contact.id };
  const [encounters, invoices, tasks, messages] = await Promise.all([
    ctx.db.encounter.findMany({ where, orderBy: { occurredAt: "desc" }, take: 30, include: { documents: true } }),
    ctx.db.invoice.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 }),
    ctx.db.task.findMany({ where, orderBy: { dueOn: "desc" }, take: 10 }),
    ctx.db.message.findMany({ where, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);
  const slots = extensions(ctx);
  const t = ctx.app.terms;
  const fields = contact.fields as Record<string, string>;
  const age = ageFrom(contact.dob);
  const due = invoices.filter((i) => i.status !== "VOID").reduce((s, i) => s + i.total - i.paid, 0);

  return (
    <>
      <PageHeader
        title={contact.name}
        subtitle={[formatPhone(contact.phone), age !== null ? `${age} yrs` : null, contact.gender].filter(Boolean).join(" · ")}
        actions={
          <>
            {slots.map((e, i) => e.contactActions && <e.contactActions key={i} ctx={ctx} contact={contact} />)}
            <Link href={`/app/billing/new?contact=${contact.id}`} className="btn-secondary">New bill</Link>
            <Link href={`/app/contacts/${contact.id}/edit`} className="btn-ghost">Edit</Link>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {slots.map((e, i) => e.contactSections && <e.contactSections key={i} ctx={ctx} contact={contact} />)}
          <Card title={`${t.encounters} (${encounters.length})`}>
            {encounters.length === 0 ? (
              <Empty>No {t.encounters.toLowerCase()} yet.</Empty>
            ) : (
              <ol className="space-y-4">
                {encounters.map((e) => {
                  const d = e.data as Record<string, unknown>;
                  return (
                    <li key={e.id} className="rounded-lg border border-slate-100 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold">{formatDateTime(e.occurredAt)}</div>
                        <div className="flex gap-2">
                          {e.documents.map((doc) => (
                            <Link key={doc.id} href={`/app/documents/${doc.id}`} className="link text-xs">📄 {doc.title}</Link>
                          ))}
                        </div>
                      </div>
                      {e.summary && <p className="mt-1 text-sm text-slate-700">{e.summary}</p>}
                      {typeof d.complaints === "string" && d.complaints && <p className="mt-1 text-xs text-slate-500">Complaints: {d.complaints}</p>}
                      {typeof d.outcome === "string" && d.outcome && <p className="mt-1 text-xs text-slate-500">Outcome: {d.outcome}</p>}
                      {e.followUpOn && <p className="mt-1 text-xs text-amber-700">Follow-up: {formatDate(e.followUpOn)}</p>}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
          <Card title="Bills" actions={due > 0 ? <Badge tone="red">Due {formatMoney(due)}</Badge> : undefined}>
            {invoices.length === 0 ? (
              <Empty>No bills yet.</Empty>
            ) : (
              <table className="table">
                <tbody>
                  {invoices.map((i) => (
                    <tr key={i.id}>
                      <td><Link href={`/app/billing/${i.id}`} className="link">#{i.number}</Link></td>
                      <td>{formatDate(i.createdAt)}</td>
                      <td className="text-right">{formatMoney(i.total)}</td>
                      <td className="text-right"><InvoiceBadge status={i.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Details">
            <dl className="space-y-2 text-sm">
              {ctx.app.contactFields.map((f) => (
                <div key={f.key} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{f.label}</dt>
                  <dd className={`text-right ${f.key === "allergies" && fields[f.key] ? "font-semibold text-red-700" : ""}`}>{fields[f.key] || "—"}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Language</dt><dd>{contact.preferredLang === "hi" ? "Hindi" : "English"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Address</dt><dd className="text-right">{contact.address || "—"}</dd></div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">WhatsApp consent</dt>
                <dd>{contact.whatsappOptIn ? <Badge tone="green">Yes · {formatDate(contact.consentAt)}</Badge> : <Badge>No</Badge>}</dd>
              </div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Since</dt><dd>{formatDate(contact.createdAt)}</dd></div>
            </dl>
          </Card>
          <Card title="Follow-ups">
            {tasks.length === 0 ? (
              <p className="text-sm text-slate-500">None.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2">
                    <span>{task.title} · {formatDate(task.dueOn)}</span>
                    <TaskBadge status={task.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="WhatsApp">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages yet.</p>
            ) : (
              <ul className="space-y-3">
                {messages.map((m) => (
                  <li key={m.id} className="text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>{formatDateTime(m.createdAt)}</span>
                      <MessageBadge status={m.status} />
                    </div>
                    <p className="mt-1 rounded-lg bg-emerald-50 p-2 text-slate-700">{m.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
