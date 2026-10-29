import Link from "next/link";
import { PrintButton } from "@/platform/ui/print-button";
import { Card, Empty, PageHeader, Stat } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { api, qs } from "@/platform/api/client";
import type { Payment } from "@/platform/api/types";
import { formatMoney } from "@/platform/lib/money";
import { addDays, formatDate, formatTime, isDay, todayIst } from "@/platform/lib/time";

interface DayBook {
  date: string;
  payments: { payment: Payment; invoiceNumber: number; contactName: string }[];
  byMode: Record<string, number>;
  byStaff: Record<string, { cash: number; other: number }>;
  flags: { action: string; invoiceId: string; actorName: string; data: Record<string, unknown>; createdAt: string }[];
}

/** End-of-day cash control: every rupee received, who received it, and every discount or void. */
export default async function DayBookPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  await requireCtx();
  const date = (await searchParams).date;
  const day = isDay(date) ? date : todayIst();
  const book = await api.get<DayBook>(`/api/billing/daybook${qs({ date: day })}`);
  const payments = book.payments;
  const flagged = book.flags;
  const total = Object.values(book.byMode).reduce((a, b) => a + b, 0);
  const byStaff = Object.entries(book.byStaff);

  return (
    <>
      <PageHeader
        title="Day book"
        subtitle={formatDate(day)}
        actions={
          <>
            <Link href={`/app/billing/daybook?date=${addDays(day, -1)}`} className="btn-secondary">←</Link>
            <Link href="/app/billing/daybook" className="btn-secondary">Today</Link>
            <Link href={`/app/billing/daybook?date=${addDays(day, 1)}`} className="btn-secondary">→</Link>
            <PrintButton />
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total received" value={formatMoney(total)} hint={`${payments.length} payment(s)`} />
        <Stat label="Cash: should be in drawer" value={formatMoney(book.byMode.CASH ?? 0)} />
        <Stat label="UPI" value={formatMoney(book.byMode.UPI ?? 0)} />
        <Stat label="Card / bank / other" value={formatMoney(total - (book.byMode.CASH ?? 0) - (book.byMode.UPI ?? 0))} />
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
                  {payments.map(({ payment: p, invoiceNumber, contactName }) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{formatTime(p.receivedAt)}</td>
                      <td><Link href={`/app/billing/${p.invoiceId}`} className="link">#{invoiceNumber}</Link></td>
                      <td>{contactName}</td>
                      <td>{p.mode}{p.reference && <div className="text-xs text-slate-500">{p.reference}</div>}</td>
                      <td>{p.receivedByName ?? "—"}</td>
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
              {byStaff.map(([name, v]) => (
                <li key={name} className="flex justify-between gap-2">
                  <span>{name}</span>
                  <span>Cash {formatMoney(v.cash)} · Other {formatMoney(v.other)}</span>
                </li>
              ))}
              {byStaff.length === 0 && <li className="text-slate-500">—</li>}
            </ul>
          </Card>
          <Card title="Discounts & voids">
            {flagged.length === 0 ? (
              <p className="text-sm text-slate-500">None today. 👍</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {flagged.map((f, i) => {
                  const d = f.data as unknown as { number?: number; discount?: number; total?: number; paid?: number; reason?: string };
                  return (
                    <li key={i} className="rounded-lg bg-amber-50 p-2">
                      <b>{f.action === "invoice.voided" ? "Voided" : "Discount"}</b> on{" "}
                      <Link href={`/app/billing/${f.invoiceId}`} className="link">#{d.number}</Link> by {f.actorName}
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
