"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/platform/api/client";
import type { QueueEntry } from "@/platform/api/types";
import { int, str } from "@/platform/lib/form";
import { action, formAction } from "@/platform/kernel/actions";
import type { Ctx } from "@/platform/kernel/auth";
import { contactInput } from "@/platform/lib/contact-input";

/** Where to go once someone is called in: the app's page for it (e.g. a consultation), else the board. */
function afterStart(ctx: Ctx, entryId: string): string {
  return ctx.app.queue?.startHref(entryId) ?? "/app/queue";
}

export const addToQueueAction = action("queue.add", async (_ctx, form) => {
  await api.post("/api/modules/queue/tokens", { contactId: str(form, "contactId") });
  redirect("/app/queue");
});

/** Reception's quick walk-in: the API reuses the contact if this name + mobile exists, else registers. */
export const walkInAction = formAction("queue.walkIn", async (_ctx, form) => {
  const res = await api.post<{ entry: QueueEntry; contactName: string }>("/api/modules/queue/walk-in", contactInput(form));
  revalidatePath("/app/queue");
  return { ok: `Token #${res.entry.tokenNumber} issued to ${res.contactName}.` };
});

export const setQueueStatusAction = action("queue.setStatus", async (ctx, form) => {
  const status = str(form, "status");
  const entry = await api.post<QueueEntry>(`/api/modules/queue/entries/${str(form, "entryId")}/status`, { status });
  if (status === "IN_PROGRESS") redirect(afterStart(ctx, entry.id));
  revalidatePath("/app/queue");
});

export const callNextAction = action("queue.callNext", async (ctx) => {
  const res = await api.post<{ entry?: QueueEntry }>("/api/modules/queue/call-next");
  redirect(res.entry ? afterStart(ctx, res.entry.id) : "/app/queue");
});

export const delayNoticeAction = formAction("queue.delayNotice", async (_ctx, form) => {
  const res = await api.post<{ notified: number }>("/api/modules/queue/delay", { minutes: int(form, "minutes") });
  return { ok: `Delay notice sent to ${res.notified} waiting.` };
});

export const updateQueueSettingsAction = formAction("queue.updateSettings", async (_ctx, form) => {
  await api.put("/api/modules/queue/settings", { avgMinutes: int(form, "avgMinutes", 8) });
  revalidatePath("/app/settings");
  return { ok: "Saved." };
});
