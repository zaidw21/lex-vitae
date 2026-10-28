import type { Prisma } from "@prisma/client";
import { db } from "@/platform/lib/db";
import type { Ctx } from "@/platform/kernel/auth";

/** Any client or transaction (plain or tenant-scoped) that can write audit rows. */
type Tx = { auditLog: { create: (args: { data: Prisma.AuditLogUncheckedCreateInput }) => Promise<unknown> } };

/** Record who did what. Billing changes (discounts, voids, payments) always go through here. */
export async function audit(
  ctx: Pick<Ctx, "org" | "user">,
  entry: { action: string; entity: string; entityId?: string; data?: Prisma.InputJsonValue },
  tx: Tx = db,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      orgId: ctx.org.id,
      actorId: ctx.user.id,
      actorName: ctx.user.name,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      data: entry.data ?? {},
    },
  });
}
