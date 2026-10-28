import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/platform/lib/db";
import { UserError } from "@/platform/lib/errors";
import { canManage, type Ctx } from "@/platform/kernel/auth";
import { audit } from "./audit";

// Settings helpers for apps' own settings sections. Not server actions: call them from an action.

export function requireManager(ctx: Ctx) {
  if (!canManage(ctx)) throw new UserError("Only the owner or an admin can change settings.");
}

/** Merge app-specific values into the organization's settings (used by apps' settings sections). */
export async function mergeOrgSettings(ctx: Ctx, values: Record<string, unknown>) {
  requireManager(ctx);
  await db.organization.update({
    where: { id: ctx.org.id },
    data: { settings: { ...(ctx.org.settings as object), ...values } as Prisma.InputJsonValue },
  });
  await audit(ctx, { action: "settings.updated", entity: "Organization", entityId: ctx.org.id, data: { keys: Object.keys(values) } });
  revalidatePath("/app", "layout");
}

/** Add a catalog item. Apps pass their own `kind` and `data` (e.g. medicines); the platform handles services. */
export async function addCatalogItem(ctx: Ctx, item: { kind: string; name: string; price?: number; data?: Prisma.InputJsonValue }) {
  requireManager(ctx);
  if (!item.name.trim()) throw new UserError("Name is required.");
  await ctx.db.catalogItem.create({
    data: { orgId: ctx.org.id, kind: item.kind, name: item.name.trim().slice(0, 120), price: item.price ?? 0, data: item.data ?? {} },
  });
  revalidatePath("/app/settings");
}
