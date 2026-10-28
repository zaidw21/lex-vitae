import type { Prisma } from "@prisma/client";
import { UserError } from "@/platform/lib/errors";
import { publicCode } from "@/platform/lib/ids";
import { addDays, istDate } from "@/platform/lib/time";
import { appUrl } from "@/platform/lib/url";
import type { Ctx } from "@/platform/kernel/auth";
import { createInvoice } from "@/platform/services/billing";
import { notify } from "@/platform/services/messaging";
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
  const contact = await ctx.db.contact.findFirst({ where: { id: input.contactId } });
  if (!contact) throw new UserError("Patient not found.");
  const entry = input.queueEntryId
    ? await ctx.db.queueEntry.findFirst({ where: { id: input.queueEntryId, contactId: contact.id } })
    : null;
  if (input.queueEntryId && !entry) throw new UserError("Queue entry not found.");

  const followUpOn = input.followUpDays ? addDays(istDate(), input.followUpDays) : null;
  const clinical = {
    vitals: input.vitals,
    complaints: input.complaints,
    findings: input.findings,
    diagnosis: input.diagnosis,
    advice: input.advice,
  };
  const issuedBy = {
    name: ctx.user.name,
    title: ctx.membership.title,
    qualifications: ctx.membership.qualifications,
    registrationNo: ctx.membership.registrationNo,
  };

  const { encounter, document } = await ctx.db.$transaction(async (tx) => {
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
        data: { ...clinical, items: input.items, followUpOn: followUpOn?.toISOString() ?? null, issuedBy } as Prisma.InputJsonValue,
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

export interface ClinicSettingsValues {
  consultationFee: number; // rupees
  followUpFee: number; // rupees
  followUpFreeDays: number;
}

/** The clinic's settings with defaults applied. */
export function clinicSettings(ctx: Pick<Ctx, "org">): ClinicSettingsValues {
  const s = ctx.org.settings as Partial<ClinicSettingsValues>;
  return {
    consultationFee: s.consultationFee ?? 400,
    followUpFee: s.followUpFee ?? 0,
    followUpFreeDays: s.followUpFreeDays ?? 7,
  };
}

/** Consultation fee for this patient today: free/reduced within the follow-up window. */
export async function suggestedFee(ctx: Ctx, contactId: string): Promise<{ amount: number; reason: string }> {
  const s = clinicSettings(ctx);
  const last = await ctx.db.encounter.findFirst({
    where: { contactId, kind: "CONSULTATION" },
    orderBy: { occurredAt: "desc" },
  });
  if (last && last.occurredAt > addDays(new Date(), -s.followUpFreeDays)) {
    return { amount: s.followUpFee * 100, reason: `Follow-up within ${s.followUpFreeDays} days of last visit` };
  }
  return { amount: s.consultationFee * 100, reason: last ? "Returning patient" : "New patient" };
}
