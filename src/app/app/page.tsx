import Link from "next/link";
import { BarChart } from "@/platform/ui/bar-chart";
import { Card, PageHeader, Stat } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { extensions } from "@/platform/kernel/modules";
import { dailySeries, newVsReturning } from "@/platform/services/insights";
import { formatMoney } from "@/platform/lib/money";
import { formatDate, istDate, istDayRange } from "@/platform/lib/time";

function greeting(): string {
  const hour = (new Date().getUTCHours() + 5.5) % 24;
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const ctx = await requireCtx();
  const today = istDate();
  const { start, end } = istDayRange(today);

  const [series, mix, collectedToday, dues, followUpsDue, failed] = await Promise.all([
    dailySeries(ctx.org.id, 14),
    newVsReturning(ctx.org.id),
    ctx.db.payment.aggregate({ where: { receivedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    ctx.db.invoice.aggregate({ where: { status: { in: ["UNPAID", "PARTIAL"] } }, _sum: { total: true, paid: true } }),
    ctx.db.task.count({ where: { status: "OPEN", dueOn: { lte: today } } }),
    ctx.db.message.count({ where: { status: "FAILED", createdAt: { gte: start } } }),
  ]);
  const due = (dues._sum.total ?? 0) - (dues._sum.paid ?? 0);
  const t = ctx.app.terms;
  const widgets = extensions(ctx).flatMap((e) => e.widgets ?? []);

  return (
    <>
      <PageHeader title={`${greeting()}, ${ctx.user.name.replace(/^(Dr|Adv|Mr|Mrs|Ms)\.?\s+/i, "").split(" ")[0]}`} subtitle={`${ctx.org.name} · ${formatDate(today)}`} />
      {failed > 0 && (
        <Link href="/app/messages?failed=1" className="mb-4 block rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠ {failed} WhatsApp message(s) failed today. Review and retry →
        </Link>
      )}
      {widgets.map((Widget, i) => (
        <Widget key={i} ctx={ctx} />
      ))}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Collected today" value={formatMoney(collectedToday._sum.amount ?? 0)} href="/app/billing/daybook" />
        <Stat label="Outstanding dues" value={formatMoney(due)} href="/app/billing?f=due" />
        <Stat label="Follow-ups due" value={followUpsDue} href="/app/tasks" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`${t.encounters} per day (14 days)`}>
          <BarChart title={`${t.encounters} per day`} data={series.map((s) => ({ label: s.label, value: s.visits }))} />
        </Card>
        <Card title="Collections per day (14 days)">
          <BarChart title="Collections per day" data={series.map((s) => ({ label: s.label, value: s.collected }))} format={formatMoney} />
        </Card>
        <Card title={`${t.contacts} seen in the last 30 days`}>
          <div className="flex items-end gap-8">
            <div><div className="text-3xl font-semibold">{mix.total}</div><div className="text-xs text-slate-500">total</div></div>
            <div><div className="text-3xl font-semibold">{mix.new}</div><div className="text-xs text-slate-500">new</div></div>
            <div><div className="text-3xl font-semibold">{mix.returning}</div><div className="text-xs text-slate-500">returning</div></div>
          </div>
        </Card>
      </div>
    </>
  );
}
