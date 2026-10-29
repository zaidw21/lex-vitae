import { recordPaymentAction, voidInvoiceAction } from "@/platform/actions/billing";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { PrintButton } from "@/platform/ui/print-button";
import { Receipt } from "@/platform/ui/receipt";
import { Card } from "@/platform/ui/ui";
import { api } from "@/platform/api/client";
import type { InvoiceDetail } from "@/platform/api/types";
import { canManage, load, requireCtx } from "@/platform/kernel/auth";
import { paiseToRupees } from "@/platform/lib/money";
import { formatDateTime } from "@/platform/lib/time";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const detail = await load(api.get<InvoiceDetail>(`/api/billing/invoices/${encodeURIComponent((await params).id)}`));
  const { invoice, history } = detail;
  const due = invoice.total - invoice.paid;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex gap-2 print:hidden">
          <PrintButton />
          <a href={`/r/${invoice.publicCode}`} target="_blank" className="btn-ghost">{ctx.app.terms.contact} link ↗</a>
        </div>
        <Receipt org={{ ...ctx.org, gstin: (ctx.org.settings as { gstin?: string }).gstin ?? null }} detail={detail} />
      </div>
      <div className="space-y-6 print:hidden">
        {invoice.status !== "VOID" && due > 0 && (
          <Card title="Record payment">
            <ActionForm action={recordPaymentAction} className="space-y-3">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input name="amount" type="number" min={1} step="0.01" defaultValue={paiseToRupees(due)} className="input" aria-label="Amount" />
              <select name="mode" className="input" aria-label="Mode" defaultValue="CASH">
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="BANK">Bank transfer</option>
              </select>
              <input name="reference" placeholder="UPI / txn reference" className="input" aria-label="Reference" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="sendReceipt" defaultChecked className="accent-brand-600" /> Send receipt on WhatsApp
              </label>
              <SubmitButton className="btn-primary w-full">Record payment</SubmitButton>
            </ActionForm>
          </Card>
        )}
        <Card title="History">
          <ul className="space-y-2 text-xs">
            {history.map((h, i) => (
              <li key={i}>
                <span className="text-slate-500">{formatDateTime(h.createdAt)}</span> · <b>{h.actorName}</b> · {h.action.replace(/[._]/g, " ")}
              </li>
            ))}
          </ul>
        </Card>
        {invoice.status !== "VOID" && canManage(ctx) && (
          <Card title="Void this bill">
            <ActionForm action={voidInvoiceAction} className="space-y-3">
              <input type="hidden" name="invoiceId" value={invoice.id} />
              <input name="reason" required placeholder="Reason (required)" className="input" aria-label="Reason" />
              <SubmitButton className="btn-danger w-full">Void bill</SubmitButton>
            </ActionForm>
          </Card>
        )}
      </div>
    </div>
  );
}
