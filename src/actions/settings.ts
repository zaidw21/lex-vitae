"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, type FormState } from "@/lib/form-state";
import { int, optStr, str } from "@/lib/form";
import { rupeesToPaise } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { canManage, hashPassword, requireCtx } from "@/core/auth";
import { audit } from "@/core/audit";
import { FREQUENCIES, TIMINGS } from "@/verticals/clinic/rx";

async function requireManager() {
  const ctx = await requireCtx();
  if (!canManage(ctx)) throw new Error("Only the owner or an admin can change settings.");
  return ctx;
}

export async function updateOrgAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireManager();
    const name = str(form, "name");
    if (!name) throw new Error("Practice name is required.");
    const phoneInput = str(form, "phone");
    const phone = phoneInput ? normalizePhone(phoneInput) : null;
    if (phoneInput && !phone) throw new Error("Please enter a valid mobile number.");
    const settings: Record<string, unknown> = { ...(ctx.org.settings as object), gstin: optStr(form, "gstin") };
    if (ctx.org.vertical === "CLINIC") {
      settings.consultationFee = Math.max(0, int(form, "consultationFee", 0));
      settings.followUpFee = Math.max(0, int(form, "followUpFee", 0));
      settings.followUpFreeDays = Math.max(0, int(form, "followUpFreeDays", 7));
      settings.avgConsultMinutes = Math.min(Math.max(int(form, "avgConsultMinutes", 8), 2), 60);
    }
    await db.organization.update({
      where: { id: ctx.org.id },
      data: { name, phone, city: optStr(form, "city"), address: optStr(form, "address"), email: optStr(form, "email"), settings: settings as Prisma.InputJsonValue },
    });
    await audit(ctx, { action: "settings.updated", entity: "Organization", entityId: ctx.org.id });
    revalidatePath("/app", "layout");
    return { ok: "Saved." };
  } catch (err) {
    return fail(err);
  }
}

export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireCtx();
    const name = str(form, "name");
    if (!name) throw new Error("Name is required.");
    await db.user.update({ where: { id: ctx.user.id }, data: { name } });
    await db.membership.update({
      where: { id: ctx.membership.id },
      data: { qualifications: optStr(form, "qualifications"), registrationNo: optStr(form, "registrationNo") },
    });
    revalidatePath("/app", "layout");
    return { ok: "Saved. New documents will use these details." };
  } catch (err) {
    return fail(err);
  }
}

const ROLES: Role[] = ["ADMIN", "PRACTITIONER", "STAFF"];

export async function addMemberAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireManager();
    const email = str(form, "email").toLowerCase();
    const name = str(form, "name");
    const role = str(form, "role") as Role;
    const password = str(form, "password");
    if (!email.includes("@") || !name) throw new Error("Name and email are required.");
    if (!ROLES.includes(role)) throw new Error("Choose a role.");
    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      if (password.length < 8) throw new Error("Set a temporary password of at least 8 characters.");
      user = await db.user.create({ data: { email, name, passwordHash: await hashPassword(password) } });
    }
    await db.membership.upsert({
      where: { orgId_userId: { orgId: ctx.org.id, userId: user.id } },
      create: { orgId: ctx.org.id, userId: user.id, role },
      update: { role, active: true },
    });
    await audit(ctx, { action: "member.added", entity: "Membership", data: { email, role } });
    revalidatePath("/app/settings");
    return { ok: `${name} can now log in with ${email}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function removeMemberAction(form: FormData): Promise<void> {
  const ctx = await requireManager();
  const id = str(form, "id");
  const m = await db.membership.findFirst({ where: { id, orgId: ctx.org.id } });
  if (!m || m.role === "OWNER") throw new Error("The owner cannot be removed.");
  await db.membership.update({ where: { id }, data: { active: false } });
  await db.session.deleteMany({ where: { userId: m.userId, orgId: ctx.org.id } });
  await audit(ctx, { action: "member.removed", entity: "Membership", entityId: id });
  revalidatePath("/app/settings");
}

export async function addCatalogItemAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireManager();
    const kind = str(form, "kind") === "MEDICINE" ? "MEDICINE" : "SERVICE";
    const name = str(form, "name");
    if (!name) throw new Error("Name is required.");
    const frequency = str(form, "frequency");
    const timing = str(form, "timing");
    const days = int(form, "days", 0);
    await db.catalogItem.create({
      data: {
        orgId: ctx.org.id,
        kind,
        name: name.slice(0, 120),
        price: kind === "SERVICE" ? rupeesToPaise(str(form, "price")) : 0,
        data:
          kind === "MEDICINE"
            ? {
                dose: optStr(form, "dose") ?? undefined,
                frequency: FREQUENCIES.includes(frequency) ? frequency : "1-0-1",
                timing: TIMINGS.some((t) => t.value === timing) ? timing : "AFTER_FOOD",
                ...(days > 0 ? { days } : {}),
              }
            : {},
      },
    });
    revalidatePath("/app/settings");
    return { ok: "Added." };
  } catch (err) {
    return fail(err);
  }
}

export async function removeCatalogItemAction(form: FormData): Promise<void> {
  const ctx = await requireManager();
  await db.catalogItem.updateMany({ where: { id: str(form, "id"), orgId: ctx.org.id }, data: { active: false } });
  revalidatePath("/app/settings");
}
