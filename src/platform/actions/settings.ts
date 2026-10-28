"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/platform/lib/db";
import { UserError } from "@/platform/lib/errors";
import { optStr, str } from "@/platform/lib/form";
import { rupeesToPaise } from "@/platform/lib/money";
import { normalizePhone } from "@/platform/lib/phone";
import { action, formAction } from "@/platform/kernel/actions";
import { hashPassword } from "@/platform/kernel/auth";
import type { ModuleId } from "@/platform/kernel/types";
import { audit } from "@/platform/services/audit";
import { addCatalogItem, requireManager } from "@/platform/services/settings";


export const updateOrgAction = formAction("settings.updateOrg", async (ctx, form) => {
  requireManager(ctx);
  const name = str(form, "name");
  if (!name) throw new UserError("Practice name is required.");
  const phoneInput = str(form, "phone");
  const phone = phoneInput ? normalizePhone(phoneInput) : null;
  if (phoneInput && !phone) throw new UserError("Please enter a valid mobile number.");
  const settings = { ...(ctx.org.settings as object), gstin: optStr(form, "gstin") };
  await db.organization.update({
    where: { id: ctx.org.id },
    data: { name, phone, city: optStr(form, "city"), address: optStr(form, "address"), email: optStr(form, "email"), settings: settings as Prisma.InputJsonValue },
  });
  await audit(ctx, { action: "settings.updated", entity: "Organization", entityId: ctx.org.id });
  revalidatePath("/app", "layout");
  return { ok: "Saved." };
});

export const setModulesAction = formAction("settings.modules", async (ctx, form) => {
  requireManager(ctx);
  const allowed: ModuleId[] = [...ctx.app.modules, ...(ctx.app.optionalModules ?? [])];
  const modules = allowed.filter((m) => form.get(`module_${m}`) === "on");
  await db.organization.update({ where: { id: ctx.org.id }, data: { modules } });
  await audit(ctx, { action: "settings.modules", entity: "Organization", entityId: ctx.org.id, data: { modules } });
  revalidatePath("/app", "layout");
  return { ok: "Saved." };
});

export const updateProfileAction = formAction("settings.updateProfile", async (ctx, form) => {
  const name = str(form, "name");
  if (!name) throw new UserError("Name is required.");
  await db.user.update({ where: { id: ctx.user.id }, data: { name } });
  await ctx.db.membership.update({
    where: { id: ctx.membership.id },
    data: { qualifications: optStr(form, "qualifications"), registrationNo: optStr(form, "registrationNo") },
  });
  revalidatePath("/app", "layout");
  return { ok: "Saved. New documents will use these details." };
});

const ROLES: Role[] = ["ADMIN", "PRACTITIONER", "STAFF"];

export const addMemberAction = formAction("settings.addMember", async (ctx, form) => {
  requireManager(ctx);
  const email = str(form, "email").toLowerCase();
  const name = str(form, "name");
  const role = str(form, "role") as Role;
  const password = str(form, "password");
  if (!email.includes("@") || !name) throw new UserError("Name and email are required.");
  if (!ROLES.includes(role)) throw new UserError("Choose a role.");
  let user = await db.user.findUnique({ where: { email } });
  if (!user) {
    if (password.length < 8) throw new UserError("Set a temporary password of at least 8 characters.");
    user = await db.user.create({ data: { email, name, passwordHash: await hashPassword(password) } });
  }
  await ctx.db.membership.upsert({
    where: { orgId_userId: { orgId: ctx.org.id, userId: user.id } },
    create: { orgId: ctx.org.id, userId: user.id, role },
    update: { role, active: true },
  });
  await audit(ctx, { action: "member.added", entity: "Membership", data: { email, role } });
  revalidatePath("/app/settings");
  return { ok: `${name} can now log in with ${email}.` };
});

export const removeMemberAction = action("settings.removeMember", async (ctx, form) => {
  requireManager(ctx);
  const id = str(form, "id");
  const m = await ctx.db.membership.findFirst({ where: { id } });
  if (!m || m.role === "OWNER") throw new UserError("The owner cannot be removed.");
  await ctx.db.membership.update({ where: { id }, data: { active: false } });
  await db.session.deleteMany({ where: { userId: m.userId, orgId: ctx.org.id } });
  await audit(ctx, { action: "member.removed", entity: "Membership", entityId: id });
  revalidatePath("/app/settings");
});

export const addServiceAction = formAction("settings.addService", async (ctx, form) => {
  await addCatalogItem(ctx, { kind: "SERVICE", name: str(form, "name"), price: rupeesToPaise(str(form, "price")) });
  return { ok: "Added." };
});

export const removeCatalogItemAction = action("settings.removeCatalogItem", async (ctx, form) => {
  requireManager(ctx);
  await ctx.db.catalogItem.updateMany({ where: { id: str(form, "id") }, data: { active: false } });
  revalidatePath("/app/settings");
});
