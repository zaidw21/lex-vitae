"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PaymentMode } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, type FormState } from "@/lib/form-state";
import { optStr, str } from "@/lib/form";
import { formatMoney, rupeesToPaise } from "@/lib/money";
import { appUrl } from "@/lib/url";
import { canManage, requireCtx } from "@/core/auth";
import { createInvoice, PAYMENT_MODES, recordPayment, voidInvoice, type LineInput } from "@/core/billing";
import { findContact, findOrCreateContact } from "@/core/contacts";
import { notify } from "@/core/messaging";

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

async function sendReceipt(ctx: Awaited<ReturnType<typeof requireCtx>>, invoiceId: string, amount: number) {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { contact: true } });
  await notify(ctx, invoice.contact, "RECEIPT", { amount: formatMoney(amount), link: appUrl(`/r/${invoice.publicCode}`) });
}

export async function createInvoiceAction(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    const ctx = await requireCtx();
    const contactId = str(form, "contactId");
    const contact = contactId ? await findContact(ctx, contactId) : await findOrCreateContact(ctx, form);
    if (!contact) throw new Error("Unknown contact.");
    const mode = parseMode(str(form, "mode"));
    const discount = rupeesToPaise(str(form, "discount"));
    if (discount > 0 && !str(form, "notes")) throw new Error("Please note the reason for the discount.");
    const invoice = await createInvoice(ctx, {
      contactId: contact.id,
      matterId: optStr(form, "matterId"),
      items: parseLines(str(form, "lines")),
      discount,
      notes: optStr(form, "notes"),
      payment: mode ? { amount: rupeesToPaise(str(form, "paidNow")), mode, reference: optStr(form, "reference") } : null,
    });
    if (invoice.paid > 0 && form.get("sendReceipt") === "on") await sendReceipt(ctx, invoice.id, invoice.paid);
    id = invoice.id;
  } catch (err) {
    return fail(err);
  }
  redirect(`/app/billing/${id}`);
}

export async function recordPaymentAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireCtx();
    const mode = parseMode(str(form, "mode"));
    if (!mode) throw new Error("Choose a payment mode.");
    const { invoice, amount } = await recordPayment(ctx, str(form, "invoiceId"), {
      amount: rupeesToPaise(str(form, "amount")),
      mode,
      reference: optStr(form, "reference"),
    });
    if (form.get("sendReceipt") === "on") await sendReceipt(ctx, invoice.id, amount);
    revalidatePath(`/app/billing/${invoice.id}`);
    return { ok: `Recorded ${formatMoney(amount)} by ${mode}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function voidInvoiceAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireCtx();
    if (!canManage(ctx)) throw new Error("Only the owner or an admin can void a bill.");
    const invoice = await voidInvoice(ctx, str(form, "invoiceId"), str(form, "reason"));
    revalidatePath(`/app/billing/${invoice.id}`);
    return { ok: "Bill voided. This is recorded in the audit log." };
  } catch (err) {
    return fail(err);
  }
}
