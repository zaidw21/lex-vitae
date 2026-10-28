import Link from "next/link";
import type { Ctx } from "@/platform/kernel/auth";
import { istDate } from "@/platform/lib/time";
import { Card, Empty, Stat } from "@/platform/ui/ui";

/** Dashboard: today's board and matters that need a date. */
export async function LegalWidget({ ctx }: { ctx: Ctx }) {
  const today = istDate();
  const [hearingsToday, stale] = await Promise.all([
    ctx.db.matter.findMany({ where: { status: "OPEN", nextHearingOn: today }, orderBy: { court: "asc" }, take: 8 }),
    ctx.db.matter.count({ where: { status: "OPEN", OR: [{ nextHearingOn: null }, { nextHearingOn: { lt: today } }] } }),
  ]);
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Hearings today" value={hearingsToday.length} href="/app/hearings" />
        <Stat label="Need a date" value={stale} hint="last date passed" href="/app/hearings" />
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
