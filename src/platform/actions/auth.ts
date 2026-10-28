"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/platform/lib/db";
import { UserError } from "@/platform/lib/errors";
import { normalizePhone } from "@/platform/lib/phone";
import { publicFormAction } from "@/platform/kernel/actions";
import { endSession, hashPassword, startSession, switchOrg, verifyPassword } from "@/platform/kernel/auth";
import { provisionOrganization } from "@/platform/services/provision";
import { appFor, APPS } from "@/registry";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  phone: z.string().trim(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  orgName: z.string().trim().min(2, "Please enter your practice name."),
  city: z.string().trim().optional(),
  app: z.string().refine((id) => id in APPS, "Choose what kind of practice this is."),
});

export const signup = publicFormAction("auth.signup", async (form) => {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) throw new UserError(parsed.error.issues[0]?.message ?? "Please check the form.");
  const input = parsed.data;
  const phone = input.phone ? normalizePhone(input.phone) : null;
  if (input.phone && !phone) throw new UserError("Please enter a valid 10-digit mobile number.");
  if (await db.user.findUnique({ where: { email: input.email } })) {
    throw new UserError("An account with this email already exists. Please log in.");
  }
  const user = await db.user.create({
    data: { name: input.name, email: input.email, phone, passwordHash: await hashPassword(input.password) },
  });
  const org = await provisionOrganization({ name: input.orgName, city: input.city || null, phone, app: appFor(input.app), owner: user });
  await startSession(user.id, org.id);
  redirect("/app");
});

export const login = publicFormAction("auth.login", async (form) => {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) throw new UserError("Incorrect email or password.");
  await startSession(user.id, null);
  redirect("/app");
});

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function changeOrg(form: FormData): Promise<void> {
  await switchOrg(String(form.get("orgId") ?? ""));
  redirect("/app");
}
