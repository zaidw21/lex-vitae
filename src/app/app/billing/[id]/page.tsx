import { notFound } from "next/navigation";
import { recordPaymentAction, voidInvoiceAction } from "@/actions/billing";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { PrintButton } from "@/components/print-button";
import { Receipt } from "@/components/receipt";
import { Card } from "@/components/ui";
import { canManage, requireCtx } from "@/core/auth";
import { db } from "@/lib/db";
import { paiseToRupees } from "@/lib/money";
import { formatDateTime } from "@/lib/time";
import { appUrl } from "@/lib/url";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const invoice = await db.invoice.findFirst({
    where: { id: (await params).id, orgId: ctx.org.id },
    include: { contact: true, items: true, payments: { orderBy: { receivedAt: "asc" } } },
  });
  if (!invoice) notFound();
  const history = await db.auditLog.findMany({ where: { orgId: ctx.org.id, entity: "Invoice", entityId: invoice.id }, orderBy: { createdAt: "asc" } });
  const due = invoice.total - invoice.paid;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex gap-2 print:hidden">
          <PrintButton />
          <a href={appUrl(`/r/${invoice.publicCode}`)} target="_blank" className="btn-ghost">Patient link ↗</a>
        </div>
        <Receipt org={ctx.org} invoice={invoice} />
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
            {history.map((h) => (
              <li key={h.id}>
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
