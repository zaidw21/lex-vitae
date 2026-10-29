import Link from "next/link";
import { api, qs } from "@/platform/api/client";
import type { Invoice } from "@/platform/api/types";
import { InvoiceBadge } from "@/platform/ui/status";
import { Card, Empty, PageHeader, Stat } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { formatMoney } from "@/platform/lib/money";
import { formatDate } from "@/platform/lib/time";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "due", label: "Dues" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
];

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const ctx = await requireCtx();
  const { f = "all" } = await searchParams;
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0];
  const [invoices, summary] = await Promise.all([
    api.get<Invoice[]>(`/api/billing/invoices${qs({ filter: filter.key })}`),
    api.get<{ todayByMode: Record<string, number>; collectedToday: number; outstanding: number }>("/api/billing/summary"),
  ]);
  const byMode = summary.todayByMode;
  const todayTotal = summary.collectedToday;
  const due = summary.outstanding;

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
              <thead><tr><th>#</th><th>Date</th><th>{ctx.app.terms.contact}</th><th className="text-right">Total</th><th className="text-right">Paid</th><th>Status</th></tr></thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="hover:bg-slate-50">
                    <td><Link href={`/app/billing/${i.id}`} className="link">#{i.number}</Link></td>
                    <td className="whitespace-nowrap">{formatDate(i.createdAt)}</td>
                    <td>{i.contactName}</td>
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
