"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/platform/api/client";
import type { Contact } from "@/platform/api/types";
import { contactInput } from "@/platform/lib/contact-input";
import { formAction } from "@/platform/kernel/actions";

function safeNext(value: FormDataEntryValue | null, fallback: string): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/app") ? v : fallback;
}

export const createContactAction = formAction("contacts.create", async (_ctx, form) => {
  const contact = await api.post<Contact>("/api/contacts", contactInput(form));
  redirect(safeNext(form.get("next"), `/app/contacts/${contact.id}`).replace("{id}", contact.id));
});

export const updateContactAction = formAction("contacts.update", async (_ctx, form) => {
  const id = String(form.get("id"));
  await api.put<Contact>(`/api/contacts/${id}`, contactInput(form));
  revalidatePath(`/app/contacts/${id}`);
  redirect(`/app/contacts/${id}`);
});
