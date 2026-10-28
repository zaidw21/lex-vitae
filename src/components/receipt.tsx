import type { Contact, Invoice, InvoiceItem, Organization, Payment } from "@prisma/client";
import { formatMoney } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { formatDate, formatDateTime } from "@/lib/time";

export function Receipt({
  org,
  invoice,
}: {
  org: Organization;
  invoice: Invoice & { contact: Contact; items: InvoiceItem[]; payments: Payment[] };
}) {
  const gstin = (org.settings as { gstin?: string }).gstin;
  return (
    <article className="mx-auto max-w-[148mm] bg-white p-6 text-sm shadow-sm print:p-0 print:shadow-none">
      <header className="flex justify-between gap-4 border-b border-slate-200 pb-3">
        <div>
          <div className="text-lg font-semibold">{org.name}</div>
          {org.address && <div className="text-xs text-slate-600">{org.address}</div>}
          {org.phone && <div className="text-xs text-slate-600">{formatPhone(org.phone)}</div>}
          {gstin && <div className="text-xs text-slate-600">GSTIN {gstin}</div>}
        </div>
        <div className="text-right">
          <div className="font-semibold">{invoice.status === "VOID" ? "VOID" : invoice.status === "PAID" ? "Receipt" : "Bill"}</div>
          <div className="text-xs text-slate-600">#{invoice.number}</div>
          <div className="text-xs text-slate-600">{formatDate(invoice.createdAt)}</div>
        </div>
      </header>
      <p className="mt-3">
        <span className="text-slate-500">To:</span> <b>{invoice.contact.name}</b> · {formatPhone(invoice.contact.phone)}
      </p>
      <table className="mt-3 w-full">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-1">Item</th>
            <th className="py-1 text-right">Qty</th>
            <th className="py-1 text-right">Rate</th>
            <th className="py-1 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((i) => (
            <tr key={i.id} className="border-b border-slate-100">
              <td className="py-1.5">{i.description}</td>
              <td className="py-1.5 text-right">{i.qty}</td>
              <td className="py-1.5 text-right">{formatMoney(i.unitPrice)}</td>
              <td className="py-1.5 text-right">{formatMoney(i.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-3 w-56 space-y-1">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(invoice.subtotal)}</dd></div>
        {invoice.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatMoney(invoice.discount)}</dd></div>}
        <div className="flex justify-between font-semibold"><dt>Total</dt><dd>{formatMoney(invoice.total)}</dd></div>
        <div className="flex justify-between text-emerald-700"><dt>Paid</dt><dd>{formatMoney(invoice.paid)}</dd></div>
        {invoice.status !== "VOID" && invoice.total > invoice.paid && (
          <div className="flex justify-between font-semibold text-red-700"><dt>Balance due</dt><dd>{formatMoney(invoice.total - invoice.paid)}</dd></div>
        )}
      </dl>
      {invoice.payments.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          {invoice.payments.map((p) => `${formatMoney(p.amount)} by ${p.mode}${p.reference ? ` (${p.reference})` : ""} on ${formatDateTime(p.receivedAt)}`).join(" · ")}
        </p>
      )}
      {invoice.status === "VOID" && <p className="mt-3 font-semibold text-red-700">This bill was voided: {invoice.voidReason}</p>}
      <p className="mt-6 text-center text-xs text-slate-400">Thank you · धन्यवाद</p>
    </article>
  );
}
