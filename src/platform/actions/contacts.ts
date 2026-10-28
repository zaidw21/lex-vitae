"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserError } from "@/platform/lib/errors";
import { formAction } from "@/platform/kernel/actions";
import { createContact, findContact, parseContactForm } from "@/platform/services/contacts";

function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/app") ? v : fallback;
}

export const createContactAction = formAction("contacts.create", async (ctx, form) => {
  const contact = await createContact(ctx, form);
  redirect(safeNext(form.get("next"), `/app/contacts/${contact.id}`).replace("{id}", contact.id));
});

export const updateContactAction = formAction("contacts.update", async (ctx, form) => {
  const id = String(form.get("id"));
  const existing = await findContact(ctx, id);
  if (!existing) throw new UserError("Not found.");
  const data = parseContactForm(ctx, form);
  await ctx.db.contact.update({
    where: { id },
    data: { ...data, consentAt: data.whatsappOptIn ? (existing.consentAt ?? new Date()) : null },
  });
  revalidatePath(`/app/contacts/${id}`);
  redirect(`/app/contacts/${id}`);
});
