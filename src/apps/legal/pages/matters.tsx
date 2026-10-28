import Link from "next/link";
import { Badge, Card, Empty, PageHeader } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { requireApp } from "@/platform/kernel/modules";
import { withClients } from "../matters";
import { formatDate, istDate } from "@/platform/lib/time";

export default async function MattersPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const ctx = await requireCtx();
  requireApp(ctx, "legal");
  const { q = "", status = "OPEN" } = await searchParams;
  const term = q.trim();
  const clientIds = term
    ? (await ctx.db.contact.findMany({ where: { name: { contains: term, mode: "insensitive" } }, select: { id: true } })).map((c) => c.id)
    : [];
  const rows = await ctx.db.matter.findMany({
    where: {
      status: status === "CLOSED" ? "CLOSED" : "OPEN",
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { caseNumber: { contains: q, mode: "insensitive" } },
              { cnr: { contains: q, mode: "insensitive" } },
              { contactId: { in: clientIds } },
            ],
          }
        : {}),
    },
    orderBy: [{ nextHearingOn: { sort: "asc", nulls: "first" } }],
    take: 200,
  });
  const matters = await withClients(ctx, rows);
  const today = istDate();

  return (
    <>
      <PageHeader title="Matters" actions={<Link href="/app/matters/new" className="btn-primary">+ New matter</Link>} />
      <form className="mb-4 flex max-w-xl flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Title, case no., CNR or client" className="input flex-1" aria-label="Search matters" />
        <select name="status" defaultValue={status} className="input w-32" aria-label="Status">
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
        </select>
        <button className="btn-secondary">Search</button>
      </form>
      <Card>
        {matters.length === 0 ? (
          <Empty>No matters found.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Matter</th><th>Client</th><th>Court</th><th>Stage</th><th>Next date</th></tr></thead>
              <tbody>
                {matters.map((m) => {
                  const missed = m.status === "OPEN" && (!m.nextHearingOn || m.nextHearingOn < today);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td>
                        <Link href={`/app/matters/${m.id}`} className="link">{m.title}</Link>
                        <div className="text-xs text-slate-500">{[m.caseType, m.caseNumber].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td>{m.contact.name}</td>
                      <td className="text-sm">{m.court ?? "—"}</td>
                      <td className="text-sm">{m.stage ?? "—"}</td>
                      <td className="whitespace-nowrap">
                        {missed ? <Badge tone="red">{m.nextHearingOn ? `${formatDate(m.nextHearingOn)}: update` : "No date"}</Badge> : formatDate(m.nextHearingOn)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
