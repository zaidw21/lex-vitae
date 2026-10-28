import type { InvoiceStatus, PaymentMode, Prisma } from "@prisma/client";
import { db } from "@/platform/lib/db";
import { UserError } from "@/platform/lib/errors";
import { publicCode } from "@/platform/lib/ids";
import type { Ctx } from "@/platform/kernel/auth";
import { audit } from "./audit";
import { nextNumber } from "./counter";

export interface LineInput {
  description: string;
  qty: number;
  unitPrice: number; // paise
}

export function computeTotals(items: LineInput[], discount: number) {
  const subtotal = items.reduce((sum, i) => sum + Math.max(0, i.qty) * Math.max(0, i.unitPrice), 0);
  const clampedDiscount = Math.min(Math.max(0, discount), subtotal);
  return { subtotal, discount: clampedDiscount, total: subtotal - clampedDiscount };
}

export function statusFor(total: number, paid: number): InvoiceStatus {
  if (paid <= 0) return total === 0 ? "PAID" : "UNPAID";
  return paid >= total ? "PAID" : "PARTIAL";
}

export const PAYMENT_MODES: PaymentMode[] = ["CASH", "UPI", "CARD", "BANK", "OTHER"];

export async function createInvoice(
  ctx: Ctx,
  input: {
    contactId: string;
    encounterId?: string | null;
    /** Optional link to an app record, e.g. { refType: "matter", refId }. */
    ref?: { refType: string; refId: string } | null;
    items: LineInput[];
    discount?: number;
    notes?: string | null;
    payment?: { amount: number; mode: PaymentMode; reference?: string | null } | null;
  },
) {
  const items = input.items.filter((i) => i.description.trim() && i.qty > 0);
  if (items.length === 0) throw new UserError("Add at least one item.");
  const totals = computeTotals(items, input.discount ?? 0);
  const paid = input.payment ? Math.min(Math.max(0, input.payment.amount), totals.total) : 0;

  return db.$transaction(async (tx) => {
    const contact = await tx.contact.findFirst({ where: { id: input.contactId, orgId: ctx.org.id } });
    if (!contact) throw new UserError("Unknown contact.");
    const number = await nextNumber(tx, ctx.org.id, "invoice");
    const invoice = await tx.invoice.create({
      data: {
        orgId: ctx.org.id,
        number,
        contactId: contact.id,
        encounterId: input.encounterId ?? null,
        refType: input.ref?.refType ?? null,
        refId: input.ref?.refId ?? null,
        ...totals,
        paid,
        status: statusFor(totals.total, paid),
        notes: input.notes ?? null,
        publicCode: publicCode(),
        createdById: ctx.user.id,
        items: {
          create: items.map((i) => ({
            description: i.description.trim(),
            qty: i.qty,
            unitPrice: i.unitPrice,
            amount: i.qty * i.unitPrice,
          })),
        },
      },
    });
    if (paid > 0 && input.payment) {
      await tx.payment.create({
        data: {
          orgId: ctx.org.id,
          invoiceId: invoice.id,
          amount: paid,
          mode: input.payment.mode,
          reference: input.payment.reference ?? null,
          receivedById: ctx.user.id,
        },
      });
    }
    await audit(
      ctx,
      {
        action: totals.discount > 0 ? "invoice.created_with_discount" : "invoice.created",
        entity: "Invoice",
        entityId: invoice.id,
        data: { number, total: totals.total, discount: totals.discount, paid } satisfies Prisma.InputJsonValue,
      },
      tx,
    );
    return invoice;
  });
}

export async function recordPayment(
  ctx: Ctx,
  invoiceId: string,
  payment: { amount: number; mode: PaymentMode; reference?: string | null },
) {
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, orgId: ctx.org.id } });
    if (!invoice) throw new UserError("Invoice not found.");
    if (invoice.status === "VOID") throw new UserError("This invoice is void.");
    const due = invoice.total - invoice.paid;
    const amount = Math.min(Math.max(0, payment.amount), due);
    if (amount <= 0) throw new UserError("Nothing is due on this invoice.");
    await tx.payment.create({
      data: {
        orgId: ctx.org.id,
        invoiceId,
        amount,
        mode: payment.mode,
        reference: payment.reference ?? null,
        receivedById: ctx.user.id,
      },
    });
    const paid = invoice.paid + amount;
    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { paid, status: statusFor(invoice.total, paid) },
    });
    await audit(ctx, { action: "payment.recorded", entity: "Invoice", entityId: invoiceId, data: { amount, mode: payment.mode } }, tx);
    return { invoice: updated, amount };
  });
}

export async function voidInvoice(ctx: Ctx, invoiceId: string, reason: string) {
  if (!reason.trim()) throw new UserError("A reason is required to void an invoice.");
  return db.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, orgId: ctx.org.id } });
    if (!invoice) throw new UserError("Invoice not found.");
    if (invoice.status === "VOID") return invoice;
    const updated = await tx.invoice.update({ where: { id: invoiceId }, data: { status: "VOID", voidReason: reason.trim() } });
    await audit(
      ctx,
      { action: "invoice.voided", entity: "Invoice", entityId: invoiceId, data: { number: invoice.number, total: invoice.total, paid: invoice.paid, reason: reason.trim() } },
      tx,
    );
    return updated;
  });
}
