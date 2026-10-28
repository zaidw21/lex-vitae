import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { publicCode } from "@/lib/ids";
import { addDays, istDate } from "@/lib/time";
import { appUrl } from "@/lib/url";
import type { Ctx } from "@/core/auth";
import { createInvoice } from "@/core/billing";
import { notify } from "@/core/messaging";
import type { RxItem } from "./rx";

export type Vitals = {
  bp?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  weight?: string;
  sugar?: string;
};

export interface ConsultationInput {
  contactId: string;
  queueEntryId: string | null;
  vitals: Vitals;
  complaints: string;
  findings: string;
  diagnosis: string;
  advice: string;
  items: RxItem[];
  followUpDays: number | null;
  fee: number | null; // paise; null = do not bill
  paymentMode: "CASH" | "UPI" | "CARD" | null; // null = unpaid
  sendWhatsApp: boolean;
}

/** Everything that happens when a doctor finishes a consultation, in one step. */
export async function saveConsultation(ctx: Ctx, input: ConsultationInput) {
  const contact = await db.contact.findFirst({ where: { id: input.contactId, orgId: ctx.org.id } });
  if (!contact) throw new Error("Patient not found.");
  const entry = input.queueEntryId
    ? await db.queueEntry.findFirst({ where: { id: input.queueEntryId, orgId: ctx.org.id, contactId: contact.id } })
    : null;
  if (input.queueEntryId && !entry) throw new Error("Queue entry not found.");

  const followUpOn = input.followUpDays ? addDays(istDate(), input.followUpDays) : null;
  const clinical = {
    vitals: input.vitals,
    complaints: input.complaints,
    findings: input.findings,
    diagnosis: input.diagnosis,
    advice: input.advice,
  };
  const doctor = {
    name: ctx.user.name,
    title: ctx.membership.title,
    qualifications: ctx.membership.qualifications,
    registrationNo: ctx.membership.registrationNo,
  };

  const { encounter, document } = await db.$transaction(async (tx) => {
    const encounter = await tx.encounter.create({
      data: {
        orgId: ctx.org.id,
        contactId: contact.id,
        providerId: ctx.membership.id,
        queueEntryId: entry?.id ?? null,
        kind: "CONSULTATION",
        summary: input.diagnosis || input.complaints || null,
        data: clinical as Prisma.InputJsonValue,
        followUpOn,
      },
    });
    const document = await tx.document.create({
      data: {
        orgId: ctx.org.id,
        contactId: contact.id,
        encounterId: encounter.id,
        type: "PRESCRIPTION",
        title: "Prescription",
        data: { ...clinical, items: input.items, followUpOn: followUpOn?.toISOString() ?? null, doctor } as Prisma.InputJsonValue,
        publicCode: publicCode(),
        createdById: ctx.user.id,
      },
    });
    if (followUpOn) {
      await tx.task.create({
        data: { orgId: ctx.org.id, contactId: contact.id, kind: "FOLLOW_UP", title: "Follow-up visit", dueOn: followUpOn },
      });
    }
    if (entry && entry.status !== "DONE") {
      await tx.queueEntry.update({
        where: { id: entry.id },
        data: { status: "DONE", completedAt: new Date(), startedAt: entry.startedAt ?? new Date() },
      });
      if (entry.appointmentId) await tx.appointment.update({ where: { id: entry.appointmentId }, data: { status: "COMPLETED" } });
    }
    return { encounter, document };
  });

  if (input.fee !== null) {
    await createInvoice(ctx, {
      contactId: contact.id,
      encounterId: encounter.id,
      items: [{ description: input.fee === 0 ? "Follow-up consultation (free)" : "Consultation", qty: 1, unitPrice: input.fee }],
      payment: input.paymentMode && input.fee > 0 ? { amount: input.fee, mode: input.paymentMode } : null,
    });
  }
  if (input.sendWhatsApp) {
    await notify(ctx, contact, "DOCUMENT_SHARED", { link: appUrl(`/d/${document.publicCode}`) });
  }
  return { encounter, document };
}

/** Consultation fee for this patient today: free/reduced within the follow-up window. */
export async function suggestedFee(ctx: Ctx, contactId: string): Promise<{ amount: number; reason: string }> {
  const s = ctx.org.settings as { consultationFee?: number; followUpFee?: number; followUpFreeDays?: number };
  const fee = (s.consultationFee ?? 400) * 100;
  const windowDays = s.followUpFreeDays ?? 7;
  const last = await db.encounter.findFirst({
    where: { orgId: ctx.org.id, contactId, kind: "CONSULTATION" },
    orderBy: { occurredAt: "desc" },
  });
  if (last && last.occurredAt > addDays(new Date(), -windowDays)) {
    return { amount: (s.followUpFee ?? 0) * 100, reason: `Follow-up within ${windowDays} days of last visit` };
  }
  return { amount: fee, reason: last ? "Returning patient" : "New patient" };
}
