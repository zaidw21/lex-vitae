import Link from "next/link";
import type { InvoiceStatus } from "@prisma/client";
import { InvoiceBadge } from "@/components/status";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { requireCtx } from "@/core/auth";
import { requireModule } from "@/core/modules";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate, istDate, istDayRange } from "@/lib/time";

const FILTERS: { key: string; label: string; status?: InvoiceStatus[] }[] = [
  { key: "all", label: "All" },
  { key: "due", label: "Dues", status: ["UNPAID", "PARTIAL"] },
  { key: "paid", label: "Paid", status: ["PAID"] },
  { key: "void", label: "Void", status: ["VOID"] },
];

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const ctx = await requireCtx();
  requireModule(ctx, "billing");
  const { f = "all" } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];
  const { start, end } = istDayRange(istDate());

  const [invoices, todayByMode, outstanding] = await Promise.all([
    db.invoice.findMany({
      where: { orgId: ctx.org.id, ...(filter.status ? { status: { in: filter.status } } : {}) },
      include: { contact: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.payment.groupBy({ by: ["mode"], where: { orgId: ctx.org.id, receivedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.invoice.aggregate({ where: { orgId: ctx.org.id, status: { in: ["UNPAID", "PARTIAL"] } }, _sum: { total: true, paid: true } }),
  ]);
  const byMode = Object.fromEntries(todayByMode.map((m) => [m.mode, m._sum.amount ?? 0]));
  const todayTotal = Object.values(byMode).reduce((a, b) => a + b, 0);
  const due = (outstanding._sum.total ?? 0) - (outstanding._sum.paid ?? 0);

  return (
    <>
      <PageHeader
        title="Billing"
        actions={
          <>
            <Link href="/app/billing/daybook" className="btn-secondary">📒 Day book</Link>
            <Link href="/app/billing/new" className="btn-primary">+ New bill</Link>
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Collected today" value={formatMoney(todayTotal)} href="/app/billing/daybook" />
        <Stat label="Cash today" value={formatMoney(byMode.CASH ?? 0)} />
        <Stat label="UPI / card today" value={formatMoney((byMode.UPI ?? 0) + (byMode.CARD ?? 0) + (byMode.BANK ?? 0))} />
        <Stat label="Outstanding dues" value={formatMoney(due)} href="/app/billing?f=due" />
      </div>
      <div className="mb-3 flex gap-1">
        {FILTERS.map((x) => (
          <Link key={x.key} href={`/app/billing?f=${x.key}`} className={`btn-sm ${x.key === filter.key ? "btn-primary" : "btn-secondary"}`}>{x.label}</Link>
        ))}
      </div>
      <Card>
        {invoices.length === 0 ? (
          <Empty>No bills here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>#</th><th>Date</th><th>{ctx.pack.terms.contact}</th><th className="text-right">Total</th><th className="text-right">Paid</th><th>Status</th></tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td><Link href={`/app/billing/${i.id}`} className="link">#{i.number}</Link></td>
                    <td className="whitespace-nowrap">{formatDate(i.createdAt)}</td>
                    <td>{i.contact.name}</td>
                    <td className="text-right">{formatMoney(i.total)}{i.discount > 0 && <div className="text-xs text-amber-700">−{formatMoney(i.discount)} disc.</div>}</td>
                    <td className="text-right">{formatMoney(i.paid)}</td>
                    <td><InvoiceBadge status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
