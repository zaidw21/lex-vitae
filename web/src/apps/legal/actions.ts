"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/platform/api/client";
import { contactInput } from "@/platform/lib/contact-input";
import { optStr, str } from "@/platform/lib/form";
import { action, formAction } from "@/platform/kernel/actions";

export const createMatterAction = formAction("legal.createMatter", async (_ctx, form) => {
  const contactId = optStr(form, "contactId");
  const { id } = await api.post<{ id: string }>("/api/apps/legal/matters", {
    contactId,
    client: contactId ? null : contactInput(form),
    title: str(form, "title"),
    caseNumber: optStr(form, "caseNumber"),
    cnr: optStr(form, "cnr"),
    court: optStr(form, "court"),
    caseType: optStr(form, "caseType"),
    oppositeParty: optStr(form, "oppositeParty"),
    stage: optStr(form, "stage"),
    nextHearingOn: optStr(form, "nextHearingOn"),
  });
  redirect(`/app/matters/${id}`);
});

export const recordHearingAction = formAction("legal.recordHearing", async (_ctx, form) => {
  const matterId = str(form, "matterId");
  await api.post(`/api/apps/legal/matters/${matterId}/hearings`, {
    heldOn: optStr(form, "heldOn"),
    purpose: str(form, "purpose"),
    outcome: str(form, "outcome"),
    nextDate: optStr(form, "nextDate"),
    stage: optStr(form, "stage"),
    notifyClient: form.get("notifyClient") === "on",
  });
  revalidatePath(`/app/matters/${matterId}`);
  return { ok: "Hearing recorded." };
});

export const setMatterStatusAction = action("legal.setMatterStatus", async (_ctx, form) => {
  const id = str(form, "id");
  await api.post(`/api/apps/legal/matters/${id}/status`, { status: str(form, "status") });
  revalidatePath(`/app/matters/${id}`);
});
