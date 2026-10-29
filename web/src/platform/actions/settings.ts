"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/platform/api/client";
import { optStr, str } from "@/platform/lib/form";
import { action, formAction } from "@/platform/kernel/actions";

export const updateOrgAction = formAction("settings.updateOrg", async (_ctx, form) => {
  await api.put("/api/org", {
    name: str(form, "name"),
    phone: optStr(form, "phone"),
    city: optStr(form, "city"),
    address: optStr(form, "address"),
    email: optStr(form, "email"),
    gstin: optStr(form, "gstin"),
  });
  revalidatePath("/app", "layout");
  return { ok: "Saved." };
});

export const setModulesAction = formAction("settings.modules", async (ctx, form) => {
  const modules = ctx.session.modules.map((m) => m.id).filter((id) => form.get(`module_${id}`) === "on");
  await api.put("/api/org/modules", { modules });
  revalidatePath("/app", "layout");
  return { ok: "Saved." };
});

export const updateProfileAction = formAction("settings.updateProfile", async (_ctx, form) => {
  await api.put("/api/me", { name: str(form, "name"), qualifications: optStr(form, "qualifications"), registrationNo: optStr(form, "registrationNo") });
  revalidatePath("/app", "layout");
  return { ok: "Saved. New documents will use these details." };
});

export const addMemberAction = formAction("settings.addMember", async (_ctx, form) => {
  const name = str(form, "name");
  const email = str(form, "email");
  await api.post("/api/team", { name, email, role: str(form, "role"), password: str(form, "password") });
  revalidatePath("/app/settings");
  return { ok: `${name} can now log in with ${email}.` };
});

export const removeMemberAction = action("settings.removeMember", async (_ctx, form) => {
  await api.del(`/api/team/${str(form, "id")}`);
  revalidatePath("/app/settings");
});

export const addServiceAction = formAction("settings.addService", async (_ctx, form) => {
  await api.post("/api/catalog/services", { name: str(form, "name"), price: str(form, "price") });
  revalidatePath("/app/settings");
  return { ok: "Added." };
});

export const removeCatalogItemAction = action("settings.removeCatalogItem", async (_ctx, form) => {
  await api.del(`/api/catalog/${str(form, "id")}`);
  revalidatePath("/app/settings");
});
