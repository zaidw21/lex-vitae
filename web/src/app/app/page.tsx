import Link from "next/link";
import { api } from "@/platform/api/client";
import { requireCtx } from "@/platform/kernel/auth";
import { extensions } from "@/platform/kernel/modules";
import { formatMoney } from "@/platform/lib/money";
import { formatDate, todayIst } from "@/platform/lib/time";
import { BarChart } from "@/platform/ui/bar-chart";
import { Card, PageHeader, Stat } from "@/platform/ui/ui";

interface Dashboard {
  days: { date: string; visits: number; collected: number }[];
  mix: { total: number; newCount: number; returning: number };
  collectedToday: number;
  outstanding: number;
  followUpsDue: number;
  failedMessagesToday: number;
}

function greeting(): string {
  const hour = (new Date().getUTCHours() + 5.5) % 24;
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function DashboardPage() {
  const ctx = await requireCtx();
  const d = await api.get<Dashboard>("/api/dashboard");
  const t = ctx.app.terms;
  const widgets = extensions(ctx).flatMap((e) => e.widgets ?? []);

  return (
    <>
      <PageHeader title={`${greeting()}, ${ctx.user.name.replace(/^(Dr|Adv|Mr|Mrs|Ms)\.?\s+/i, "").split(" ")[0]}`} subtitle={`${ctx.org.name} · ${formatDate(todayIst())}`} />
      {d.failedMessagesToday > 0 && (
        <Link href="/app/messages?failed=1" className="mb-4 block rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          ⚠ {d.failedMessagesToday} WhatsApp message(s) failed today. Review and retry →
        </Link>
      )}
      {widgets.map((Widget, i) => (
        <Widget key={i} ctx={ctx} />
      ))}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Collected today" value={formatMoney(d.collectedToday)} href="/app/billing/daybook" />
        <Stat label="Outstanding dues" value={formatMoney(d.outstanding)} href="/app/billing?f=due" />
        <Stat label="Follow-ups due" value={d.followUpsDue} href="/app/tasks" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`${t.encounters} per day (14 days)`}>
          <BarChart title={`${t.encounters} per day`} data={d.days.map((s) => ({ label: shortDay(s.date), value: s.visits }))} />
        </Card>
        <Card title="Collections per day (14 days)">
          <BarChart title="Collections per day" data={d.days.map((s) => ({ label: shortDay(s.date), value: s.collected }))} format={formatMoney} />
        </Card>
        <Card title={`${t.contacts} seen in the last 30 days`}>
          <div className="flex items-end gap-8">
            <div><div className="text-3xl font-semibold">{d.mix.total}</div><div className="text-xs text-slate-500">total</div></div>
            <div><div className="text-3xl font-semibold">{d.mix.newCount}</div><div className="text-xs text-slate-500">new</div></div>
            <div><div className="text-3xl font-semibold">{d.mix.returning}</div><div className="text-xs text-slate-500">returning</div></div>
          </div>
        </Card>
      </div>
    </>
  );
}
