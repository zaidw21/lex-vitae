import Link from "next/link";
import { notFound } from "next/navigation";
import { callNextAction } from "@/platform/modules/queue/actions";
import { resendDocumentAction } from "@/platform/actions/documents";
import { DocumentSheet } from "@/platform/ui/document-sheet";
import { PrintButton } from "@/platform/ui/print-button";
import { requireCtx } from "@/platform/kernel/auth";
import { hasModule } from "@/platform/kernel/modules";
import { appUrl } from "@/platform/lib/url";

export default async function DocumentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string; sent?: string }> }) {
  const ctx = await requireCtx();
  const { saved, sent } = await searchParams;
  const doc = await ctx.db.document.findFirst({ where: { id: (await params).id }, include: { contact: true } });
  if (!doc) notFound();
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
          <a href={appUrl(`/d/${doc.publicCode}`)} target="_blank" className="btn-ghost">Patient link ↗</a>
          <Link href={`/app/contacts/${doc.contactId}`} className="btn-ghost">{ctx.app.terms.contact} →</Link>
          {usesQueue && (
            <form action={callNextAction}>
              <button className="btn-primary">Call next patient →</button>
            </form>
          )}
        </div>
      </div>
      <DocumentSheet doc={doc} org={ctx.org} contact={doc.contact} Body={ctx.app.documentRenderers?.[doc.type]} />
    </>
  );
}
