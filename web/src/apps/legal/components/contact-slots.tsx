import Link from "next/link";
import { api } from "@/platform/api/client";
import type { ContactSlot } from "@/platform/kernel/types";
import { formatDate } from "@/platform/lib/time";
import { Card } from "@/platform/ui/ui";
import type { Matter } from "../types";

export const NewMatterLink: ContactSlot = ({ contact }) => (
  <Link href={`/app/matters/new?contact=${contact.id}`} className="btn-primary">+ New matter</Link>
);

export const MattersSection: ContactSlot = async ({ contact }) => {
  const matters = await api.get<Matter[]>(`/api/apps/legal/clients/${contact.id}/matters`);
  if (matters.length === 0) return null;
  return (
    <Card title="Matters">
      <ul className="divide-y divide-slate-100">
        {matters.map((m) => (
          <li key={m.id} className="flex justify-between gap-3 py-2 text-sm">
            <Link href={`/app/matters/${m.id}`} className="link">{m.title}</Link>
            <span className="text-slate-500">Next: {formatDate(m.nextHearingOn)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
};
