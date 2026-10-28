import { UserError } from "@/platform/lib/errors";
import { Prisma, type QueueStatus } from "@prisma/client";
import { db } from "@/platform/lib/db";
import { publicCode } from "@/platform/lib/ids";
import { addDays, istDate } from "@/platform/lib/time";
import { appUrl } from "@/platform/lib/url";
import type { Ctx } from "@/platform/kernel/auth";
import { notify } from "@/platform/services/messaging";

/** Issue the next token for today. Retries if two receptionists issue a token at the same moment. */
export async function issueToken(
  ctx: Ctx,
  input: { contactId: string; providerId?: string | null; appointmentId?: string | null },
) {
  const date = istDate();
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const entry = await db.$transaction(async (tx) => {
        const contact = await tx.contact.findFirst({ where: { id: input.contactId, orgId: ctx.org.id } });
        if (!contact) throw new UserError("Unknown contact.");
        const existing = await tx.queueEntry.findFirst({
          where: { orgId: ctx.org.id, date, contactId: contact.id, status: { in: ["WAITING", "IN_PROGRESS"] } },
        });
        if (existing) return existing;
        const last = await tx.queueEntry.aggregate({ where: { orgId: ctx.org.id, date }, _max: { tokenNumber: true } });
        const created = await tx.queueEntry.create({
          data: {
            orgId: ctx.org.id,
            date,
            tokenNumber: (last._max.tokenNumber ?? 0) + 1,
            contactId: contact.id,
            providerId: input.providerId ?? null,
            appointmentId: input.appointmentId ?? null,
            publicCode: publicCode(),
          },
        });
        if (input.appointmentId) {
          await tx.appointment.update({ where: { id: input.appointmentId }, data: { status: "CHECKED_IN" } });
        }
        return created;
      });
      const contact = await db.contact.findUniqueOrThrow({ where: { id: entry.contactId } });
      const ahead = await peopleAhead(entry);
      await notify(ctx, contact, "TOKEN_ISSUED", { token: entry.tokenNumber, ahead, link: appUrl(`/t/${entry.publicCode}`) });
      return entry;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") continue;
      throw err;
    }
  }
  throw new UserError("Could not issue a token. Please try again.");
}

export async function peopleAhead(entry: { orgId: string; date: Date; tokenNumber: number; providerId: string | null }) {
  return db.queueEntry.count({
    where: {
      orgId: entry.orgId,
      date: entry.date,
      status: "WAITING",
      tokenNumber: { lt: entry.tokenNumber },
      ...(entry.providerId ? { OR: [{ providerId: entry.providerId }, { providerId: null }] } : {}),
    },
  });
}

const TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  WAITING: ["IN_PROGRESS", "SKIPPED", "CANCELLED"],
  IN_PROGRESS: ["DONE", "WAITING"],
  SKIPPED: ["WAITING", "CANCELLED"],
  DONE: [],
  CANCELLED: ["WAITING"],
};

export function canTransition(from: QueueStatus, to: QueueStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export async function setQueueStatus(ctx: Ctx, entryId: string, status: QueueStatus) {
  const entry = await db.queueEntry.findFirst({ where: { id: entryId, orgId: ctx.org.id } });
  if (!entry) throw new UserError("Queue entry not found.");
  if (!canTransition(entry.status, status)) throw new UserError(`Cannot move from ${entry.status} to ${status}.`);
  const now = new Date();
  const updated = await db.queueEntry.update({
    where: { id: entry.id },
    data: {
      status,
      ...(status === "IN_PROGRESS" ? { startedAt: now, providerId: entry.providerId ?? ctx.membership.id } : {}),
      ...(status === "DONE" ? { completedAt: now } : {}),
    },
  });
  if (status === "IN_PROGRESS") await nudgeUpcoming(ctx, entry.date);
  if (entry.appointmentId && (status === "DONE" || status === "CANCELLED")) {
    await db.appointment.update({
      where: { id: entry.appointmentId },
      data: { status: status === "DONE" ? "COMPLETED" : "CANCELLED" },
    });
  }
  return updated;
}

/** Tell whoever is now second in line that their turn is near. */
async function nudgeUpcoming(ctx: Ctx, date: Date) {
  const waiting = await db.queueEntry.findMany({
    where: { orgId: ctx.org.id, date, status: "WAITING" },
    orderBy: { tokenNumber: "asc" },
    take: 2,
    include: { contact: true },
  });
  const target = waiting[1];
  if (!target) return;
  const alreadyNudged = await db.message.count({
    where: { orgId: ctx.org.id, contactId: target.contactId, template: "TURN_NEAR", createdAt: { gte: target.checkedInAt } },
  });
  if (alreadyNudged === 0) await notify(ctx, target.contact, "TURN_NEAR", { token: target.tokenNumber });
}

/** Queue settings with defaults (stored in the organization's settings). */
export function queueSettings(org: { settings: unknown }): { avgMinutes: number } {
  const s = org.settings as { queueAvgMinutes?: number; avgConsultMinutes?: number };
  return { avgMinutes: s.queueAvgMinutes ?? s.avgConsultMinutes ?? 8 };
}

/** Average minutes per person served today, falling back to the configured estimate. */
export async function averageMinutes(orgId: string, date: Date, fallback: number): Promise<number> {
  const done = await db.queueEntry.findMany({
    where: { orgId, date, status: "DONE", startedAt: { not: null }, completedAt: { not: null } },
    select: { startedAt: true, completedAt: true },
    orderBy: { completedAt: "desc" },
    take: 10,
  });
  if (done.length < 3) return fallback;
  const total = done.reduce((s, e) => s + (e.completedAt!.getTime() - e.startedAt!.getTime()), 0);
  return Math.max(2, Math.round(total / done.length / 60000));
}

/** Check-ins by IST hour over the last 30 days, for staffing the front desk. */
export async function busiestHours(orgId: string) {
  const since = addDays(istDate(), -30);
  const rows = await db.queueEntry.findMany({ where: { orgId, date: { gte: since } }, select: { checkedInAt: true } });
  const counts = new Array<number>(24).fill(0);
  for (const r of rows) counts[new Date(r.checkedInAt.getTime() + 330 * 60 * 1000).getUTCHours()]++;
  return counts;
}
