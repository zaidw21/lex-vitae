import Link from "next/link";
import { BarChart } from "@/components/bar-chart";
import { Card, Empty, PageHeader, Stat } from "@/components/ui";
import { requireCtx } from "@/core/auth";
import { busiestHours, dailySeries, newVsReturning } from "@/core/insights";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate, istDate, istDayRange } from "@/lib/time";

function greeting(): string {
  const hour = (new Date().getUTCHours() + 5.5) % 24;
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const ctx = await requireCtx();
  const orgId = ctx.org.id;
  const today = istDate();
  const { start, end } = istDayRange(today);
  const isClinic = ctx.org.vertical === "CLINIC";

  const [series, mix, collectedToday, dues, followUpsDue, failed] = await Promise.all([
    dailySeries(orgId, 14),
    newVsReturning(orgId),
    db.payment.aggregate({ where: { orgId, receivedAt: { gte: start, lt: end } }, _sum: { amount: true } }),
    db.invoice.aggregate({ where: { orgId, status: { in: ["UNPAID", "PARTIAL"] } }, _sum: { total: true, paid: true } }),
    db.task.count({ where: { orgId, status: "OPEN", dueOn: { lte: today } } }),
    db.message.count({ where: { orgId, status: "FAILED", createdAt: { gte: start } } }),
  ]);
  const due = (dues._sum.total ?? 0) - (dues._sum.paid ?? 0);
  const t = ctx.pack.terms;

  let primary: React.ReactNode;
  if (isClinic) {
    const [queue, hours] = await Promise.all([
      db.queueEntry.groupBy({ by: ["status"], where: { orgId, date: today }, _count: true }),
      busiestHours(orgId),
    ]);
    const q = Object.fromEntries(queue.map((r) => [r.status, r._count]));
    const total = queue.reduce((s, r) => s + r._count, 0);
    const openHours = hours.map((count, hour) => ({ hour, count })).filter((h) => h.hour >= 7 && h.hour <= 22);
    primary = (
      <>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Patients today" value={total} hint={`${q.DONE ?? 0} seen`} href="/app/queue" />
          <Stat label="Waiting now" value={q.WAITING ?? 0} href="/app/queue" />
          <Stat label="Collected today" value={formatMoney(collectedToday._sum.amount ?? 0)} href="/app/billing/daybook" />
          <Stat label="Follow-ups due" value={followUpsDue} href="/app/tasks" />
        </div>
        <Card title="Busiest check-in hours (last 30 days)" className="mb-6">
          <BarChart
            title="Check-ins by hour of day"
            data={openHours.map((h) => ({ label: `${h.hour % 12 || 12}${h.hour < 12 ? "am" : "pm"}`, value: h.count }))}
          />
        </Card>
      </>
    );
  } else {
    const [hearingsToday, stale] = await Promise.all([
      db.matter.findMany({ where: { orgId, status: "OPEN", nextHearingOn: today }, include: { contact: true }, take: 8 }),
      db.matter.count({ where: { orgId, status: "OPEN", OR: [{ nextHearingOn: null }, { nextHearingOn: { lt: today } }] } }),
    ]);
    primary = (
      <>
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Hearings today" value={hearingsToday.length} href="/app/hearings" />
          <Stat label="Need a date" value={stale} hint="last date passed" href="/app/hearings" />
          <Stat label="Fees received today" value={formatMoney(collectedToday._sum.amount ?? 0)} href="/app/billing/daybook" />
          <Stat label="To-dos due" value={followUpsDue} href="/app/tasks" />
        </div>
        <Card title="Today's board" className="mb-6" actions={<Link href="/app/hearings" className="link text-sm">Full diary →</Link>}>
          {hearingsToday.length === 0 ? (
            <Empty>No hearings today.</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {hearingsToday.map((m) => (
                <li key={m.id} className="flex justify-between gap-2 py-2 text-sm">
                  <Link href={`/app/matters/${m.id}`} className="link">{m.title}</Link>
                  <span className="text-slate-500">{m.court}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`${greeting()}, ${ctx.user.name.replace(/^(Dr|Adv|Mr|Mrs|Ms)\.?\s+/i, "").split(" ")[0]}`} subtitle={`${ctx.org.name} · ${formatDate(today)}`} />
      {failed > 0 && (
        <Link href="/app/messages?failed=1" className="mb-4 block rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠ {failed} WhatsApp message(s) failed today. Review and retry →
        </Link>
      )}
      {primary}
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
        <Card title="Outstanding dues">
          <div className="text-3xl font-semibold">{formatMoney(due)}</div>
          <Link href="/app/billing?f=due" className="link mt-2 inline-block text-sm">See who owes →</Link>
        </Card>
      </div>
    </>
  );
}
