import Link from "next/link";
import { Empty, PageHeader } from "@/platform/ui/ui";
import { api, qs } from "@/platform/api/client";
import type { Contact } from "@/platform/api/types";
import { requireCtx } from "@/platform/kernel/auth";
import { formatPhone } from "@/platform/lib/phone";
import { formatDate } from "@/platform/lib/time";

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const ctx = await requireCtx();
  const { q = "" } = await searchParams;
  const rows = await api.get<{ contact: Contact; visits: number; lastSeen: string | null }[]>(`/api/contacts${qs({ q, limit: 100 })}`);
  const contacts = rows.map((r) => r.contact);
  const visits = new Map(rows.map((r) => [r.contact.id, r]));
  const t = ctx.app.terms;

  return (
    <>
      <PageHeader
        title={t.contacts}
        subtitle={`Search by name or mobile number`}
        actions={<Link href="/app/contacts/new" className="btn-primary">+ New {t.contact.toLowerCase()}</Link>}
      />
      <form className="mb-4 flex max-w-md gap-2">
        <input name="q" defaultValue={q} placeholder="Name or mobile…" className="input" aria-label="Search" />
        <button className="btn-secondary">Search</button>
      </form>
      {contacts.length === 0 ? (
        <Empty>{q ? `No ${t.contacts.toLowerCase()} match “${q}”.` : `No ${t.contacts.toLowerCase()} yet.`}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Age / sex</th>
                <th>{t.encounters}</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const v = visits.get(c.id);
                const age = c.age;
                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td>
                      <Link href={`/app/contacts/${c.id}`} className="link">{c.name}</Link>
                    </td>
                    <td className="whitespace-nowrap">{formatPhone(c.phone)}</td>
                    <td>{[age !== null ? `${age}y` : null, c.gender].filter(Boolean).join(" / ") || "—"}</td>
                    <td>{v?.visits ?? 0}</td>
                    <td className="whitespace-nowrap">{formatDate(v?.lastSeen)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
