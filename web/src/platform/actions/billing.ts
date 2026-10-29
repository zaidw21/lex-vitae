"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/platform/api/client";
import type { Contact, Invoice } from "@/platform/api/types";
import { contactInput } from "@/platform/lib/contact-input";
import { optStr, str } from "@/platform/lib/form";
import { formatMoney } from "@/platform/lib/money";
import { formAction } from "@/platform/kernel/actions";

function parseLines(json: string) {
  try {
    const raw = JSON.parse(json || "[]");
    return Array.isArray(raw)
      ? raw.slice(0, 50).map((r: Record<string, unknown>) => ({
          description: String(r.description ?? ""),
          qty: Number.parseInt(String(r.qty), 10) || 0,
          unitPrice: String(r.unitPrice ?? "0"),
        }))
      : [];
  } catch {
    return [];
  }
}

export const createInvoiceAction = formAction("billing.createInvoice", async (_ctx, form) => {
  let contactId = optStr(form, "contactId");
  if (!contactId) contactId = (await api.post<Contact>("/api/contacts/find-or-create", contactInput(form))).id;
  const invoice = await api.post<Invoice>("/api/billing/invoices", {
    contactId,
    refType: optStr(form, "refType"),
    refId: optStr(form, "refId"),
    lines: parseLines(str(form, "lines")),
    discount: str(form, "discount"),
    notes: optStr(form, "notes"),
    paidNow: str(form, "paidNow"),
    mode: optStr(form, "mode"),
    reference: optStr(form, "reference"),
    sendReceipt: form.get("sendReceipt") === "on",
  });
  redirect(`/app/billing/${invoice.id}`);
});

export const recordPaymentAction = formAction("billing.recordPayment", async (_ctx, form) => {
  const id = str(form, "invoiceId");
  const mode = str(form, "mode");
  const { amount } = await api.post<{ amount: number }>(`/api/billing/invoices/${id}/payments`, {
    amount: str(form, "amount"),
    mode,
    reference: optStr(form, "reference"),
    sendReceipt: form.get("sendReceipt") === "on",
  });
  revalidatePath(`/app/billing/${id}`);
  return { ok: `Recorded ${formatMoney(amount)} by ${mode}.` };
});

export const voidInvoiceAction = formAction("billing.voidInvoice", async (_ctx, form) => {
  const id = str(form, "invoiceId");
  await api.post(`/api/billing/invoices/${id}/void`, { reason: str(form, "reason") });
  revalidatePath(`/app/billing/${id}`);
  return { ok: "Bill voided. This is recorded in the audit log." };
});
