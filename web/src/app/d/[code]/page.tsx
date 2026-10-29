import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentSheet } from "@/platform/ui/document-sheet";
import { PrintButton } from "@/platform/ui/print-button";
import { api, ApiError } from "@/platform/api/client";
import type { Contact, DocumentRecord, PublicOrg } from "@/platform/api/types";
import { appUi } from "@/registry";

export const metadata: Metadata = { title: "Your document", robots: { index: false } };

export default async function PublicDocumentPage({ params }: { params: Promise<{ code: string }> }) {
  const res = await api
    .public<{ org: PublicOrg; document: DocumentRecord; contact: Contact }>(`/api/public/documents/${encodeURIComponent((await params).code)}`)
    .catch((err) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    });
  const { org, document: doc, contact } = res;
  return (
    <main className="min-h-screen bg-slate-100 px-2 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex max-w-[210mm] justify-end print:hidden">
        <PrintButton label="Download / print" />
      </div>
      <DocumentSheet doc={doc} org={org} contact={contact} Body={appUi(org.app).documentRenderers?.[doc.type]} />
    </main>
  );
}
