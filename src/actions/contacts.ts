"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fail, type FormState } from "@/lib/form-state";
import { requireCtx } from "@/core/auth";
import { createContact, findContact, parseContactForm } from "@/core/contacts";

function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/app") ? v : fallback;
}

export async function createContactAction(_: FormState, form: FormData): Promise<FormState> {
  let target: string;
  try {
    const ctx = await requireCtx();
    const contact = await createContact(ctx, form);
    target = safeNext(form.get("next"), `/app/contacts/${contact.id}`).replace("{id}", contact.id);
  } catch (err) {
    return fail(err);
  }
  redirect(target);
}

export async function updateContactAction(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    const ctx = await requireCtx();
    id = String(form.get("id"));
    const existing = await findContact(ctx, id);
    if (!existing) throw new Error("Not found.");
    const data = parseContactForm(ctx, form);
    await db.contact.update({
      where: { id },
      data: { ...data, consentAt: data.whatsappOptIn ? (existing.consentAt ?? new Date()) : null },
    });
    revalidatePath(`/app/contacts/${id}`);
  } catch (err) {
    return fail(err);
  }
  redirect(`/app/contacts/${id}`);
}
