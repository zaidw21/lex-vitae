import type { Contact, Matter } from "@prisma/client";
import { UserError } from "@/platform/lib/errors";
import { formatDate } from "@/platform/lib/time";
import type { Ctx } from "@/platform/kernel/auth";
import { audit } from "@/platform/services/audit";
import { notify } from "@/platform/services/messaging";

/** Platform records (encounters, invoices, tasks, documents) point at a matter with this ref. */
export const MATTER_REF = "matter";

export function matterRef(matterId: string) {
  return { refType: MATTER_REF, refId: matterId };
}

export async function findMatter(ctx: Ctx, id: string) {
  return ctx.db.matter.findFirst({ where: { id } });
}

/** Attach each matter's client (matters store contactId only; there is no DB relation into the platform). */
export async function withClients<T extends Pick<Matter, "contactId">>(ctx: Ctx, matters: T[]): Promise<(T & { contact: Contact })[]> {
  const contacts = await ctx.db.contact.findMany({ where: { id: { in: [...new Set(matters.map((m) => m.contactId))] } } });
  const byId = new Map(contacts.map((c) => [c.id, c]));
  return matters.flatMap((m) => {
    const contact = byId.get(m.contactId);
    return contact ? [{ ...m, contact }] : [];
  });
}

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
  const matter = await findMatter(ctx, input.matterId);
  if (!matter) throw new UserError("Matter not found.");
  const contact = await ctx.db.contact.findFirst({ where: { id: matter.contactId } });
  if (!contact) throw new UserError("Client not found.");
  if (!input.outcome.trim()) throw new UserError("Please note what happened at the hearing.");
  if (input.nextDate && input.nextDate <= input.heldOn) throw new UserError("The next date must be after the hearing date.");

  const encounter = await ctx.db.$transaction(async (tx) => {
    const encounter = await tx.encounter.create({
      data: {
        orgId: ctx.org.id,
        contactId: matter.contactId,
        providerId: ctx.membership.id,
        ...matterRef(matter.id),
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
    await notify(ctx, contact, "HEARING_UPDATE", {
      matter: matter.caseNumber ? `${matter.title} (${matter.caseNumber})` : matter.title,
      outcome: input.outcome,
      next: input.nextDate ? formatDate(input.nextDate) : "to be notified",
    });
  }
  return encounter;
}
