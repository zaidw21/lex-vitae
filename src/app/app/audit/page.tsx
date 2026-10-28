import { notFound } from "next/navigation";
import { Card, Empty, PageHeader } from "@/components/ui";
import { canManage, requireCtx } from "@/core/auth";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/time";

export default async function AuditPage() {
  const ctx = await requireCtx();
  if (!canManage(ctx)) notFound();
  const logs = await db.auditLog.findMany({ where: { orgId: ctx.org.id }, orderBy: { createdAt: "desc" }, take: 200 });
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
                {logs.map((l) => (
                  <tr key={l.id}>
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
