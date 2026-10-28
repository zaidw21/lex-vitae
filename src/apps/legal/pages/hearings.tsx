import Link from "next/link";
import { PrintButton } from "@/platform/ui/print-button";
import { Card, Empty, PageHeader } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { requireApp } from "@/platform/kernel/modules";
import { withClients } from "../matters";
import { formatPhone } from "@/platform/lib/phone";
import { addDays, formatDate, istDate, parseDateInput, toDateInput } from "@/platform/lib/time";

/** The advocate's daily board: every matter listed on a date, grouped by court. */
export default async function HearingsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireCtx();
  requireApp(ctx, "legal");
  const today = istDate();
  const day = parseDateInput((await searchParams).date) ?? today;
  const [listedRows, stale, week] = await Promise.all([
    ctx.db.matter.findMany({ where: { status: "OPEN", nextHearingOn: day }, orderBy: { court: "asc" } }),
    ctx.db.matter.findMany({
      where: { status: "OPEN", OR: [{ nextHearingOn: null }, { nextHearingOn: { lt: today } }] },
      orderBy: { nextHearingOn: "asc" },
    }),
    ctx.db.matter.groupBy({
      by: ["nextHearingOn"],
      where: { status: "OPEN", nextHearingOn: { gte: today, lt: addDays(today, 7) } },
      _count: true,
    }),
  ]);
  const listed = await withClients(ctx, listedRows);
  const byCourt = new Map<string, typeof listed>();
  for (const m of listed) {
    const key = m.court ?? "Court not set";
    byCourt.set(key, [...(byCourt.get(key) ?? []), m]);
  }
  const counts = new Map(week.map((w) => [w.nextHearingOn!.getTime(), w._count]));

  return (
    <>
      <PageHeader
        title="Hearing diary"
        subtitle={formatDate(day)}
        actions={
          <>
            <Link href={`/app/hearings?date=${toDateInput(addDays(day, -1))}`} className="btn-secondary">←</Link>
            <Link href="/app/hearings" className="btn-secondary">Today</Link>
            <Link href={`/app/hearings?date=${toDateInput(addDays(day, 1))}`} className="btn-secondary">→</Link>
            <PrintButton />
          </>
        }
      />
      <div className="mb-6 flex gap-2 overflow-x-auto print:hidden">
        {Array.from({ length: 7 }, (_, i) => addDays(today, i)).map((d) => (
          <Link
            key={d.toISOString()}
            href={`/app/hearings?date=${toDateInput(d)}`}
            className={`card min-w-[84px] p-2 text-center ${d.getTime() === day.getTime() ? "border-brand-500 bg-brand-50" : ""}`}
          >
            <div className="text-xs text-slate-500">{d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" })}</div>
            <div className="text-lg font-semibold">{counts.get(d.getTime()) ?? 0}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {listed.length === 0 && <Empty>No matters listed on this date.</Empty>}
          {[...byCourt.entries()].map(([court, matters]) => (
            <Card key={court} title={`${court} (${matters.length})`}>
              <ul className="divide-y divide-slate-100">
                {matters.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="text-sm">
                      <Link href={`/app/matters/${m.id}`} className="link">{m.title}</Link>
                      <div className="text-xs text-slate-500">
                        {[m.caseNumber, m.stage, `${m.contact.name} · ${formatPhone(m.contact.phone)}`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Link href={`/app/matters/${m.id}`} className="btn-primary btn-sm print:hidden">Record outcome</Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <Card title={`⚠ Needs a date (${stale.length})`} className="print:hidden">
          <p className="mb-3 text-xs text-slate-500">Open matters whose last date has passed without an update, or that have no date at all.</p>
          {stale.length === 0 ? (
            <p className="text-sm text-slate-500">All matters are up to date. 👍</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {stale.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <Link href={`/app/matters/${m.id}`} className="link">{m.title}</Link>
                  <span className="text-xs text-red-700">{m.nextHearingOn ? formatDate(m.nextHearingOn) : "no date"}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
