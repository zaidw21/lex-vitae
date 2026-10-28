"use server";

import { redirect } from "next/navigation";
import type { Vertical } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { fail, type FormState } from "@/lib/form-state";
import { normalizePhone } from "@/lib/phone";
import { endSession, hashPassword, startSession, switchOrg, verifyPassword } from "@/core/auth";
import { provisionOrganization } from "@/core/provision";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().toLowerCase().email("Please enter a valid email."),
  phone: z.string().trim(),
  password: z.string().min(8, "Password must be at least 8 characters."),
  orgName: z.string().trim().min(2, "Please enter your practice name."),
  city: z.string().trim().optional(),
  vertical: z.enum(["CLINIC", "LEGAL"]),
});

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  try {
    const input = signupSchema.parse(Object.fromEntries(form));
    const phone = input.phone ? normalizePhone(input.phone) : null;
    if (input.phone && !phone) return { error: "Please enter a valid 10-digit mobile number." };
    if (await db.user.findUnique({ where: { email: input.email } })) {
      return { error: "An account with this email already exists. Please log in." };
    }
    const user = await db.user.create({
      data: { name: input.name, email: input.email, phone, passwordHash: await hashPassword(input.password) },
    });
    const org = await provisionOrganization({
      name: input.orgName,
      city: input.city || null,
      phone,
      vertical: input.vertical as Vertical,
      owner: user,
    });
    await startSession(user.id, org.id);
  } catch (err) {
    if (err instanceof z.ZodError) return { error: err.issues[0]?.message ?? "Please check the form." };
    return fail(err);
  }
  redirect("/app");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  try {
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const user = await db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return { error: "Incorrect email or password." };
    }
    await startSession(user.id, null);
  } catch (err) {
    return fail(err);
  }
  redirect("/app");
}

export async function logout(): Promise<void> {
  await endSession();
  redirect("/login");
}

export async function changeOrg(form: FormData): Promise<void> {
  await switchOrg(String(form.get("orgId") ?? ""));
  redirect("/app");
}
