"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fail, type FormState } from "@/lib/form-state";
import { optStr, str } from "@/lib/form";
import { parseDateInput } from "@/lib/time";
import { requireCtx } from "@/core/auth";
import { findContact, findOrCreateContact } from "@/core/contacts";
import { requireModule } from "@/core/modules";
import { recordHearing } from "@/verticals/legal/matters";

export async function createMatterAction(_: FormState, form: FormData): Promise<FormState> {
  let id: string;
  try {
    const ctx = await requireCtx();
    requireModule(ctx, "matters");
    const contactId = str(form, "contactId");
    const contact = contactId ? await findContact(ctx, contactId) : await findOrCreateContact(ctx, form);
    if (!contact) throw new Error("Unknown client.");
    const title = str(form, "title");
    if (!title) throw new Error("Give the matter a title, e.g. “Sharma vs. State”.");
    const matter = await db.matter.create({
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
    id = matter.id;
  } catch (err) {
    return fail(err);
  }
  redirect(`/app/matters/${id}`);
}

export async function recordHearingAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireCtx();
    requireModule(ctx, "matters");
    const heldOn = parseDateInput(str(form, "heldOn"));
    if (!heldOn) throw new Error("Pick the hearing date.");
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
  } catch (err) {
    return fail(err);
  }
}

export async function setMatterStatusAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const status = str(form, "status") === "CLOSED" ? "CLOSED" : "OPEN";
  await db.matter.updateMany({ where: { id: str(form, "id"), orgId: ctx.org.id }, data: { status } });
  revalidatePath(`/app/matters/${str(form, "id")}`);
}
