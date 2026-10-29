import { notFound } from "next/navigation";
import { Card, Empty, PageHeader } from "@/platform/ui/ui";
import { canManage, requireCtx } from "@/platform/kernel/auth";
import { api } from "@/platform/api/client";
import { formatDateTime } from "@/platform/lib/time";

export default async function AuditPage() {
  const ctx = await requireCtx();
  if (!canManage(ctx)) notFound();
  const logs = await api.get<{ actorName: string | null; action: string; data: Record<string, unknown>; createdAt: string }[]>("/api/audit");
  return (
    <>
      <PageHeader title="Audit log" subtitle="Who changed what. Entries cannot be edited or deleted." />
      <Card>
        {logs.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr></thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                    <td>{l.actorName ?? "—"}</td>
                    <td>{l.action.replace(/[._]/g, " ")}</td>
                    <td className="max-w-md truncate font-mono text-xs text-slate-500">{JSON.stringify(l.data)}</td>
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
