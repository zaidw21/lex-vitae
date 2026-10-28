"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { QueueStatus } from "@prisma/client";
import { UserError } from "@/platform/lib/errors";
import { int, str } from "@/platform/lib/form";
import { istDate } from "@/platform/lib/time";
import { appUrl } from "@/platform/lib/url";
import { action, formAction } from "@/platform/kernel/actions";
import type { Ctx } from "@/platform/kernel/auth";
import { requireModule } from "@/platform/kernel/modules";
import { findOrCreateContact } from "@/platform/services/contacts";
import { notify } from "@/platform/services/messaging";
import { mergeOrgSettings } from "@/platform/services/settings";
import { issueToken, setQueueStatus } from "./service";

/** Where to go once someone is called in: the app's page for it (e.g. a consultation), else the board. */
function afterStart(ctx: Ctx, entryId: string): string {
  return ctx.app.queue?.startHref(entryId) ?? "/app/queue";
}

export const addToQueueAction = action("queue.add", async (ctx, form) => {
  requireModule(ctx, "queue");
  await issueToken(ctx, { contactId: str(form, "contactId") });
  redirect("/app/queue");
});

/** Reception's quick walk-in: reuse the contact if this name + mobile already exists, else register. */
export const walkInAction = formAction("queue.walkIn", async (ctx, form) => {
  requireModule(ctx, "queue");
  const contact = await findOrCreateContact(ctx, form);
  const entry = await issueToken(ctx, { contactId: contact.id });
  revalidatePath("/app/queue");
  return { ok: `Token #${entry.tokenNumber} issued to ${contact.name}.` };
});

export const setQueueStatusAction = action("queue.setStatus", async (ctx, form) => {
  requireModule(ctx, "queue");
  const status = str(form, "status") as QueueStatus;
  const entry = await setQueueStatus(ctx, str(form, "entryId"), status);
  if (status === "IN_PROGRESS") redirect(afterStart(ctx, entry.id));
  revalidatePath("/app/queue");
});

export const callNextAction = action("queue.callNext", async (ctx) => {
  requireModule(ctx, "queue");
  const next = await ctx.db.queueEntry.findFirst({ where: { date: istDate(), status: "WAITING" }, orderBy: { tokenNumber: "asc" } });
  if (!next) redirect("/app/queue");
  await setQueueStatus(ctx, next.id, "IN_PROGRESS");
  redirect(afterStart(ctx, next.id));
});

/** Tell everyone still waiting that we are running late. */
export const delayNoticeAction = formAction("queue.delayNotice", async (ctx, form) => {
  requireModule(ctx, "queue");
  const minutes = int(form, "minutes");
  if (minutes < 5 || minutes > 300) throw new UserError("Enter a delay between 5 and 300 minutes.");
  const waiting = await ctx.db.queueEntry.findMany({ where: { date: istDate(), status: "WAITING" }, include: { contact: true } });
  for (const w of waiting) await notify(ctx, w.contact, "DELAY_NOTICE", { minutes, link: appUrl(`/t/${w.publicCode}`) });
  return { ok: `Delay notice sent to ${waiting.length} waiting.` };
});

export const updateQueueSettingsAction = formAction("queue.updateSettings", async (ctx, form) => {
  requireModule(ctx, "queue");
  await mergeOrgSettings(ctx, { queueAvgMinutes: Math.min(Math.max(int(form, "avgMinutes", 8), 2), 120) });
  return { ok: "Saved." };
});
