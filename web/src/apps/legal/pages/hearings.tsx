import Link from "next/link";
import { api, qs } from "@/platform/api/client";
import { load, requireCtx } from "@/platform/kernel/auth";
import { requireApp } from "@/platform/kernel/modules";
import { formatPhone } from "@/platform/lib/phone";
import { addDays, formatDate, formatWeekday, isDay } from "@/platform/lib/time";
import { PrintButton } from "@/platform/ui/print-button";
import { Card, Empty, PageHeader } from "@/platform/ui/ui";
import type { Diary, Matter } from "../types";

/** The advocate's daily board: every matter listed on a date, grouped by court. */
export default async function HearingsPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const ctx = await requireCtx();
  requireApp(ctx, "legal");
  const requested = (await searchParams).date;
  const diary = await load(api.get<Diary>(`/api/apps/legal/hearings${qs({ date: isDay(requested) ? requested : null })}`));
  const day = diary.date;
  const byCourt = new Map<string, Matter[]>();
  for (const m of diary.listed) {
    const key = m.court ?? "Court not set";
    byCourt.set(key, [...(byCourt.get(key) ?? []), m]);
  }

  return (
    <>
      <PageHeader
        title="Hearing diary"
        subtitle={formatDate(day)}
        actions={
          <>
            <Link href={`/app/hearings?date=${addDays(day, -1)}`} className="btn-secondary">←</Link>
            <Link href="/app/hearings" className="btn-secondary">Today</Link>
            <Link href={`/app/hearings?date=${addDays(day, 1)}`} className="btn-secondary">→</Link>
            <PrintButton />
          </>
        }
      />
      <div className="mb-6 flex gap-2 overflow-x-auto print:hidden">
        {Object.entries(diary.week).map(([d, count]) => (
          <Link key={d} href={`/app/hearings?date=${d}`} className={`card min-w-[84px] p-2 text-center ${d === day ? "border-brand-500 bg-brand-50" : ""}`}>
            <div className="text-xs text-slate-500">{formatWeekday(d)}</div>
            <div className="text-lg font-semibold">{count}</div>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {diary.listed.length === 0 && <Empty>No matters listed on this date.</Empty>}
          {[...byCourt.entries()].map(([court, matters]) => (
            <Card key={court} title={`${court} (${matters.length})`}>
              <ul className="divide-y divide-slate-100">
                {matters.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div className="text-sm">
                      <Link href={`/app/matters/${m.id}`} className="link">{m.title}</Link>
                      <div className="text-xs text-slate-500">
                        {[m.caseNumber, m.stage, `${m.clientName} · ${formatPhone(m.clientPhone)}`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Link href={`/app/matters/${m.id}`} className="btn-primary btn-sm print:hidden">Record outcome</Link>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
        <Card title={`⚠ Needs a date (${diary.needsDate.length})`} className="print:hidden">
          <p className="mb-3 text-xs text-slate-500">Open matters whose last date has passed without an update, or that have no date at all.</p>
          {diary.needsDate.length === 0 ? (
            <p className="text-sm text-slate-500">All matters are up to date. 👍</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {diary.needsDate.map((m) => (
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

export const dynamic = "force-dynamic";
