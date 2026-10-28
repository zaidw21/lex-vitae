import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/platform/ui/print-button";
import { Receipt } from "@/platform/ui/receipt";
import { db } from "@/platform/lib/db";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

export default async function PublicReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  const invoice = await db.invoice.findUnique({
    where: { publicCode: (await params).code },
    include: { org: true, contact: true, items: true, payments: true },
  });
  if (!invoice) notFound();
  return (
    <main className="min-h-screen bg-slate-100 px-2 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex max-w-[148mm] justify-end print:hidden">
        <PrintButton label="Download / print" />
      </div>
      <Receipt org={invoice.org} invoice={invoice} />
    </main>
  );
}
