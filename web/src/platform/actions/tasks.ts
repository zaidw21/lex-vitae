"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/platform/api/client";
import { optStr, str } from "@/platform/lib/form";
import { action, formAction } from "@/platform/kernel/actions";

export const remindTaskAction = action("tasks.remind", async (_ctx, form) => {
  await api.post(`/api/tasks/${str(form, "id")}/remind`);
  revalidatePath("/app/tasks");
});

/** Remind everyone whose follow-up is due tomorrow and has not been reminded yet. */
export const remindTomorrowAction = formAction("tasks.remindTomorrow", async () => {
  const { sent } = await api.post<{ sent: number }>("/api/tasks/remind-tomorrow");
  revalidatePath("/app/tasks");
  return { ok: `Sent ${sent} reminder(s).` };
});

export const setTaskStatusAction = action("tasks.setStatus", async (_ctx, form) => {
  await api.post(`/api/tasks/${str(form, "id")}/status`, { status: str(form, "status") });
  revalidatePath("/app/tasks");
});

/** Create a to-do, optionally for a contact and/or linked to an app record (refType + refId). */
export const createTaskAction = formAction("tasks.create", async (_ctx, form) => {
  await api.post("/api/tasks", {
    title: str(form, "title"),
    dueOn: optStr(form, "dueOn"),
    contactId: optStr(form, "contactId"),
    refType: optStr(form, "refType"),
    refId: optStr(form, "refId"),
  });
  revalidatePath("/app", "layout");
  return { ok: "Added." };
});
