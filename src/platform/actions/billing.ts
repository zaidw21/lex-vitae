"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentMode } from "@prisma/client";
import { UserError } from "@/platform/lib/errors";
import { optStr, str } from "@/platform/lib/form";
import { formatMoney, rupeesToPaise } from "@/platform/lib/money";
import { appUrl } from "@/platform/lib/url";
import { formAction } from "@/platform/kernel/actions";
import { canManage, type Ctx } from "@/platform/kernel/auth";
import { createInvoice, PAYMENT_MODES, recordPayment, voidInvoice, type LineInput } from "@/platform/services/billing";
import { findContact, findOrCreateContact } from "@/platform/services/contacts";
import { notify } from "@/platform/services/messaging";

function parseMode(value: string): PaymentMode | null {
  return PAYMENT_MODES.includes(value as PaymentMode) ? (value as PaymentMode) : null;
}

function parseLines(json: string): LineInput[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json || "[]");
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((r: Record<string, unknown>) => ({
    description: String(r.description ?? "").slice(0, 200),
    qty: Math.min(Math.max(Number.parseInt(String(r.qty), 10) || 0, 0), 1000),
    unitPrice: rupeesToPaise(String(r.unitPrice ?? "0")),
  }));
}

async function sendReceipt(ctx: Ctx, invoiceId: string, amount: number) {
  const invoice = await ctx.db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { contact: true } });
  await notify(ctx, invoice.contact, "RECEIPT", { amount: formatMoney(amount), link: appUrl(`/r/${invoice.publicCode}`) });
}

export const createInvoiceAction = formAction("billing.createInvoice", async (ctx, form) => {
  const contactId = str(form, "contactId");
  const contact = contactId ? await findContact(ctx, contactId) : await findOrCreateContact(ctx, form);
  if (!contact) throw new UserError("Unknown contact.");
  const mode = parseMode(str(form, "mode"));
  const discount = rupeesToPaise(str(form, "discount"));
  if (discount > 0 && !str(form, "notes")) throw new UserError("Please note the reason for the discount.");
  const refType = optStr(form, "refType");
  const refId = optStr(form, "refId");
  const invoice = await createInvoice(ctx, {
    contactId: contact.id,
    ref: refType && refId ? { refType, refId } : null,
    items: parseLines(str(form, "lines")),
    discount,
    notes: optStr(form, "notes"),
    payment: mode ? { amount: rupeesToPaise(str(form, "paidNow")), mode, reference: optStr(form, "reference") } : null,
  });
  if (invoice.paid > 0 && form.get("sendReceipt") === "on") await sendReceipt(ctx, invoice.id, invoice.paid);
  redirect(`/app/billing/${invoice.id}`);
});

export const recordPaymentAction = formAction("billing.recordPayment", async (ctx, form) => {
  const mode = parseMode(str(form, "mode"));
  if (!mode) throw new UserError("Choose a payment mode.");
  const { invoice, amount } = await recordPayment(ctx, str(form, "invoiceId"), {
    amount: rupeesToPaise(str(form, "amount")),
    mode,
    reference: optStr(form, "reference"),
  });
  if (form.get("sendReceipt") === "on") await sendReceipt(ctx, invoice.id, amount);
  revalidatePath(`/app/billing/${invoice.id}`);
  return { ok: `Recorded ${formatMoney(amount)} by ${mode}.` };
});

export const voidInvoiceAction = formAction("billing.voidInvoice", async (ctx, form) => {
  if (!canManage(ctx)) throw new UserError("Only the owner or an admin can void a bill.");
  const invoice = await voidInvoice(ctx, str(form, "invoiceId"), str(form, "reason"));
  revalidatePath(`/app/billing/${invoice.id}`);
  return { ok: "Bill voided. This is recorded in the audit log." };
});
