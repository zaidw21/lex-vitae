import Link from "next/link";
import { PrintButton } from "@/platform/ui/print-button";
import { Card, Empty, PageHeader, Stat } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { db } from "@/platform/lib/db";
import { formatMoney } from "@/platform/lib/money";
import { addDays, formatDate, formatTime, istDate, istDayRange, parseDateInput, toDateInput } from "@/platform/lib/time";

/** End-of-day cash control: every rupee received, who received it, and every discount or void. */
export default async function DayBookPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireCtx();
  const day = parseDateInput((await searchParams).date) ?? istDate();
  const { start, end } = istDayRange(day);

  const [payments, flagged, users] = await Promise.all([
    db.payment.findMany({
      where: { orgId: ctx.org.id, receivedAt: { gte: start, lt: end } },
      include: { invoice: { include: { contact: true } } },
      orderBy: { receivedAt: "asc" },
    }),
    db.auditLog.findMany({
      where: { orgId: ctx.org.id, createdAt: { gte: start, lt: end }, action: { in: ["invoice.voided", "invoice.created_with_discount"] } },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({ where: { memberships: { some: { orgId: ctx.org.id } } }, select: { id: true, name: true } }),
  ]);
  const names = new Map(users.map((u) => [u.id, u.name]));
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const sum = (filter: (p: (typeof payments)[number]) => boolean) => payments.filter(filter).reduce((s, p) => s + p.amount, 0);
  const byStaff = new Map<string, { cash: number; other: number }>();
  for (const p of payments) {
    const key = p.receivedById ?? "unknown";
    const row = byStaff.get(key) ?? { cash: 0, other: 0 };
    if (p.mode === "CASH") row.cash += p.amount;
    else row.other += p.amount;
    byStaff.set(key, row);
  }

  return (
    <>
      <PageHeader
        title="Day book"
        subtitle={formatDate(day)}
        actions={
          <>
            <Link href={`/app/billing/daybook?date=${toDateInput(addDays(day, -1))}`} className="btn-secondary">←</Link>
            <Link href="/app/billing/daybook" className="btn-secondary">Today</Link>
            <Link href={`/app/billing/daybook?date=${toDateInput(addDays(day, 1))}`} className="btn-secondary">→</Link>
            <PrintButton />
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total received" value={formatMoney(total)} hint={`${payments.length} payment(s)`} />
        <Stat label="Cash: should be in drawer" value={formatMoney(sum((p) => p.mode === "CASH"))} />
        <Stat label="UPI" value={formatMoney(sum((p) => p.mode === "UPI"))} />
        <Stat label="Card / bank / other" value={formatMoney(sum((p) => !["CASH", "UPI"].includes(p.mode)))} />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="Payments" className="lg:col-span-2">
          {payments.length === 0 ? (
            <Empty>No payments recorded on this day.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Time</th><th>Bill</th><th>From</th><th>Mode</th><th>Received by</th><th className="text-right">Amount</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{formatTime(p.receivedAt)}</td>
                      <td><Link href={`/app/billing/${p.invoiceId}`} className="link">#{p.invoice.number}</Link></td>
                      <td>{p.invoice.contact.name}</td>
                      <td>{p.mode}{p.reference && <div className="text-xs text-slate-500">{p.reference}</div>}</td>
                      <td>{names.get(p.receivedById ?? "") ?? "—"}</td>
                      <td className="text-right">{formatMoney(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="space-y-6">
          <Card title="By staff member">
            <ul className="space-y-2 text-sm">
              {[...byStaff.entries()].map(([id, v]) => (
                <li key={id} className="flex justify-between gap-2">
                  <span>{names.get(id) ?? "Unknown"}</span>
                  <span>Cash {formatMoney(v.cash)} · Other {formatMoney(v.other)}</span>
                </li>
              ))}
              {byStaff.size === 0 && <li className="text-slate-500">—</li>}
            </ul>
          </Card>
          <Card title="Discounts & voids">
            {flagged.length === 0 ? (
              <p className="text-sm text-slate-500">None today. 👍</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {flagged.map((f) => {
                  const d = f.data as { number?: number; discount?: number; total?: number; paid?: number; reason?: string };
                  return (
                    <li key={f.id} className="rounded-lg bg-amber-50 p-2">
                      <b>{f.action === "invoice.voided" ? "Voided" : "Discount"}</b> on{" "}
                      <Link href={`/app/billing/${f.entityId}`} className="link">#{d.number}</Link> by {f.actorName}
                      <div className="text-xs text-slate-600">
                        {f.action === "invoice.voided" ? `${formatMoney(d.total ?? 0)}${d.paid ? ` (${formatMoney(d.paid)} was already collected)` : ""} · ${d.reason}` : `${formatMoney(d.discount ?? 0)} off`} · {formatTime(f.createdAt)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
