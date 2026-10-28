"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { QueueStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, type FormState } from "@/lib/form-state";
import { int, str } from "@/lib/form";
import { istDate } from "@/lib/time";
import { appUrl } from "@/lib/url";
import { requireCtx } from "@/core/auth";
import { findOrCreateContact } from "@/core/contacts";
import { notify } from "@/core/messaging";
import { requireModule } from "@/core/modules";
import { issueToken, setQueueStatus } from "@/core/queue";

export async function addToQueueAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  requireModule(ctx, "queue");
  await issueToken(ctx, { contactId: str(form, "contactId") });
  redirect("/app/queue");
}

/** Reception's quick walk-in: reuse the patient if this name + mobile already exists, else register. */
export async function walkInAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireCtx();
    requireModule(ctx, "queue");
    const contact = await findOrCreateContact(ctx, form);
    const entry = await issueToken(ctx, { contactId: contact.id });
    revalidatePath("/app/queue");
    return { ok: `Token #${entry.tokenNumber} issued to ${contact.name}.` };
  } catch (err) {
    return fail(err);
  }
}

export async function setQueueStatusAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const status = str(form, "status") as QueueStatus;
  const entry = await setQueueStatus(ctx, str(form, "entryId"), status);
  if (status === "IN_PROGRESS" && ctx.org.vertical === "CLINIC") redirect(`/app/consult?entry=${entry.id}`);
  revalidatePath("/app/queue");
}

export async function callNextAction(): Promise<void> {
  const ctx = await requireCtx();
  const next = await db.queueEntry.findFirst({
    where: { orgId: ctx.org.id, date: istDate(), status: "WAITING" },
    orderBy: { tokenNumber: "asc" },
  });
  if (!next) redirect("/app/queue");
  await setQueueStatus(ctx, next.id, "IN_PROGRESS");
  redirect(`/app/consult?entry=${next.id}`);
}

/** Tell everyone still waiting that the doctor is running late. */
export async function delayNoticeAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireCtx();
    const minutes = int(form, "minutes");
    if (minutes < 5 || minutes > 300) return { error: "Enter a delay between 5 and 300 minutes." };
    const waiting = await db.queueEntry.findMany({
      where: { orgId: ctx.org.id, date: istDate(), status: "WAITING" },
      include: { contact: true },
    });
    for (const w of waiting) {
      await notify(ctx, w.contact, "DELAY_NOTICE", { minutes, link: appUrl(`/t/${w.publicCode}`) });
    }
    return { ok: `Delay notice sent to ${waiting.length} waiting patient(s).` };
  } catch (err) {
    return fail(err);
  }
}
