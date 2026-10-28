import { BarChart } from "@/platform/ui/bar-chart";
import { Card, Stat } from "@/platform/ui/ui";
import type { Ctx } from "@/platform/kernel/auth";
import { istDate } from "@/platform/lib/time";
import { busiestHours } from "./service";

export async function QueueWidget({ ctx }: { ctx: Ctx }) {
  const [queue, hours] = await Promise.all([
    ctx.db.queueEntry.groupBy({ by: ["status"], where: { date: istDate() }, _count: true }),
    busiestHours(ctx.org.id),
  ]);
  const q = Object.fromEntries(queue.map((r) => [r.status, r._count]));
  const total = queue.reduce((s, r) => s + r._count, 0);
  const openHours = hours.map((count, hour) => ({ hour, count })).filter((h) => h.hour >= 7 && h.hour <= 22);
  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label={`${ctx.app.terms.contacts} today`} value={total} hint={`${q.DONE ?? 0} seen`} href="/app/queue" />
        <Stat label="Waiting now" value={q.WAITING ?? 0} href="/app/queue" />
        <Stat label={`With ${ctx.app.terms.practitioner.toLowerCase()}`} value={q.IN_PROGRESS ?? 0} href="/app/queue" />
      </div>
      <Card title="Busiest check-in hours (last 30 days)" className="mb-6">
        <BarChart
          title="Check-ins by hour of day"
          data={openHours.map((h) => ({ label: `${h.hour % 12 || 12}${h.hour < 12 ? "am" : "pm"}`, value: h.count }))}
        />
      </Card>
    </>
  );
}
