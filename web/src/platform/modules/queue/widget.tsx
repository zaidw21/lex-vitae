import { api } from "@/platform/api/client";
import type { Ctx } from "@/platform/kernel/auth";
import { BarChart } from "@/platform/ui/bar-chart";
import { Card, Stat } from "@/platform/ui/ui";
import type { Summary } from "./types";

export async function QueueWidget({ ctx }: { ctx: Ctx }) {
  const s = await api.get<Summary>("/api/modules/queue/summary");
  const q = s.byStatus;
  const total = Object.values(q).reduce((a, b) => a + (b ?? 0), 0);
  const openHours = s.checkInsByHour.map((count, hour) => ({ hour, count })).filter((h) => h.hour >= 7 && h.hour <= 22);
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
