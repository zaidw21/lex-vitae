import { db } from "@/lib/db";
import { formatDate } from "@/lib/time";
import type { Ctx } from "@/core/auth";
import { audit } from "@/core/audit";
import { notify } from "@/core/messaging";

export interface HearingInput {
  matterId: string;
  heldOn: Date;
  purpose: string;
  outcome: string;
  nextDate: Date | null;
  stage: string | null;
  notifyClient: boolean;
}

/** Record what happened at a hearing, move the matter to its next date and tell the client. */
export async function recordHearing(ctx: Ctx, input: HearingInput) {
  const matter = await db.matter.findFirst({ where: { id: input.matterId, orgId: ctx.org.id }, include: { contact: true } });
  if (!matter) throw new Error("Matter not found.");
  if (!input.outcome.trim()) throw new Error("Please note what happened at the hearing.");
  if (input.nextDate && input.nextDate <= input.heldOn) throw new Error("The next date must be after the hearing date.");

  const encounter = await db.$transaction(async (tx) => {
    const encounter = await tx.encounter.create({
      data: {
        orgId: ctx.org.id,
        contactId: matter.contactId,
        providerId: ctx.membership.id,
        matterId: matter.id,
        kind: "HEARING",
        occurredAt: input.heldOn,
        summary: input.outcome.slice(0, 500),
        data: { purpose: input.purpose, outcome: input.outcome, stage: input.stage ?? matter.stage, nextDate: input.nextDate?.toISOString() ?? null },
        followUpOn: input.nextDate,
      },
    });
    await tx.matter.update({
      where: { id: matter.id },
      data: {
        nextHearingOn: input.nextDate,
        stage: input.stage ?? matter.stage,
        ...(input.stage === "Disposed" ? { status: "CLOSED" } : {}),
      },
    });
    await audit(ctx, { action: "hearing.recorded", entity: "Matter", entityId: matter.id, data: { heldOn: input.heldOn.toISOString() } }, tx);
    return encounter;
  });

  if (input.notifyClient) {
    await notify(ctx, matter.contact, "HEARING_UPDATE", {
      matter: matter.caseNumber ? `${matter.title} (${matter.caseNumber})` : matter.title,
      outcome: input.outcome,
      next: input.nextDate ? formatDate(input.nextDate) : "to be notified",
    });
  }
  return encounter;
}
