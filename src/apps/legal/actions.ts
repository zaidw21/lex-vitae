"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { UserError } from "@/platform/lib/errors";
import { optStr, str } from "@/platform/lib/form";
import { parseDateInput } from "@/platform/lib/time";
import { action, formAction } from "@/platform/kernel/actions";
import { requireApp } from "@/platform/kernel/modules";
import { findContact, findOrCreateContact } from "@/platform/services/contacts";
import { recordHearing } from "./matters";

export const createMatterAction = formAction("legal.createMatter", async (ctx, form) => {
  requireApp(ctx, "legal");
  const contactId = str(form, "contactId");
  const contact = contactId ? await findContact(ctx, contactId) : await findOrCreateContact(ctx, form);
  if (!contact) throw new UserError("Unknown client.");
  const title = str(form, "title");
  if (!title) throw new UserError("Give the matter a title, e.g. “Sharma vs. State”.");
  const matter = await ctx.db.matter.create({
    data: {
      orgId: ctx.org.id,
      contactId: contact.id,
      title: title.slice(0, 200),
      caseNumber: optStr(form, "caseNumber"),
      cnr: optStr(form, "cnr")?.toUpperCase() ?? null,
      court: optStr(form, "court"),
      caseType: optStr(form, "caseType"),
      oppositeParty: optStr(form, "oppositeParty"),
      stage: optStr(form, "stage"),
      nextHearingOn: parseDateInput(str(form, "nextHearingOn")),
    },
  });
  redirect(`/app/matters/${matter.id}`);
});

export const recordHearingAction = formAction("legal.recordHearing", async (ctx, form) => {
  requireApp(ctx, "legal");
  const heldOn = parseDateInput(str(form, "heldOn"));
  if (!heldOn) throw new UserError("Pick the hearing date.");
  const matterId = str(form, "matterId");
  await recordHearing(ctx, {
    matterId,
    heldOn,
    purpose: str(form, "purpose"),
    outcome: str(form, "outcome"),
    nextDate: parseDateInput(str(form, "nextDate")),
    stage: optStr(form, "stage"),
    notifyClient: form.get("notifyClient") === "on",
  });
  revalidatePath(`/app/matters/${matterId}`);
  return { ok: "Hearing recorded." };
});

export const setMatterStatusAction = action("legal.setMatterStatus", async (ctx, form) => {
  requireApp(ctx, "legal");
  const status = str(form, "status") === "CLOSED" ? "CLOSED" : "OPEN";
  await ctx.db.matter.updateMany({ where: { id: str(form, "id") }, data: { status } });
  revalidatePath(`/app/matters/${str(form, "id")}`);
});
