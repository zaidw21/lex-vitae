import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentSheet } from "@/components/document-sheet";
import { PrintButton } from "@/components/print-button";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Your document", robots: { index: false } };

export default async function PublicDocumentPage({ params }: { params: Promise<{ code: string }> }) {
  const doc = await db.document.findUnique({ where: { publicCode: (await params).code }, include: { contact: true, org: true } });
  if (!doc) notFound();
  return (
    <main className="min-h-screen bg-slate-100 px-2 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex max-w-[210mm] justify-end print:hidden">
        <PrintButton label="Download / print" />
      </div>
      <DocumentSheet doc={doc} org={doc.org} contact={doc.contact} />
    </main>
  );
}
