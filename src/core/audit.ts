import type { Prisma, PrismaClient } from "@prisma/client";
import { db } from "@/lib/db";
import type { Ctx } from "./auth";

type Tx = PrismaClient | Prisma.TransactionClient;

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
