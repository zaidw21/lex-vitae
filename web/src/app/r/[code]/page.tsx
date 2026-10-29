import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintButton } from "@/platform/ui/print-button";
import { Receipt } from "@/platform/ui/receipt";
import { api, ApiError } from "@/platform/api/client";
import type { InvoiceDetail, PublicOrg } from "@/platform/api/types";

export const metadata: Metadata = { title: "Receipt", robots: { index: false } };

export default async function PublicReceiptPage({ params }: { params: Promise<{ code: string }> }) {
  const { org, invoice } = await api
    .public<{ org: PublicOrg; invoice: InvoiceDetail }>(`/api/public/receipts/${encodeURIComponent((await params).code)}`)
    .catch((err) => {
      if (err instanceof ApiError && err.status === 404) notFound();
      throw err;
    });
  return (
    <main className="min-h-screen bg-slate-100 px-2 py-6 print:bg-white print:p-0">
      <div className="mx-auto mb-3 flex max-w-[148mm] justify-end print:hidden">
        <PrintButton label="Download / print" />
      </div>
      <Receipt org={org} detail={invoice} />
    </main>
  );
}
