import Link from "next/link";
import { callNextAction } from "@/platform/modules/queue/actions";
import { resendDocumentAction } from "@/platform/actions/documents";
import { DocumentSheet } from "@/platform/ui/document-sheet";
import { PrintButton } from "@/platform/ui/print-button";
import { api } from "@/platform/api/client";
import type { Contact, DocumentRecord } from "@/platform/api/types";
import { load, requireCtx } from "@/platform/kernel/auth";
import { hasModule } from "@/platform/kernel/modules";

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; sent?: string }>;
}) {
  const ctx = await requireCtx();
  const { saved, sent } = await searchParams;
  const { document: doc, contact } = await load(
    api.get<{ document: DocumentRecord; contact: Contact }>(`/api/documents/${encodeURIComponent((await params).id)}`),
  );
  const usesQueue = hasModule(ctx, "queue");

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div>
          {saved && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ Saved.</p>}
          {sent && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✓ Sent on WhatsApp.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          <form action={resendDocumentAction}>
            <input type="hidden" name="id" value={doc.id} />
            <button className="btn-secondary">💬 Send on WhatsApp</button>
          </form>
          <a href={`/d/${doc.publicCode}`} target="_blank" className="btn-ghost">{ctx.app.terms.contact} link ↗</a>
          <Link href={`/app/contacts/${doc.contactId}`} className="btn-ghost">{ctx.app.terms.contact} →</Link>
          {usesQueue && (
            <form action={callNextAction}>
              <button className="btn-primary">Call next →</button>
            </form>
          )}
        </div>
      </div>
      <DocumentSheet doc={doc} org={ctx.org} contact={contact} Body={ctx.app.documentRenderers?.[doc.type]} />
    </>
  );
}
