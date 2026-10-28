"use server";

import { revalidatePath } from "next/cache";
import { UserError } from "@/platform/lib/errors";
import { optStr, str } from "@/platform/lib/form";
import { addDays, formatDate, istDate, parseDateInput } from "@/platform/lib/time";
import { action, formAction } from "@/platform/kernel/actions";
import type { Ctx } from "@/platform/kernel/auth";
import { notify } from "@/platform/services/messaging";

async function remind(ctx: Ctx, taskId: string): Promise<boolean> {
  const task = await ctx.db.task.findFirst({ where: { id: taskId }, include: { contact: true } });
  if (!task?.contact || task.status !== "OPEN") return false;
  await notify(ctx, task.contact, "FOLLOW_UP_REMINDER", { date: formatDate(task.dueOn), title: task.title });
  await ctx.db.task.update({ where: { id: task.id }, data: { remindedAt: new Date() } });
  return true;
}

export const remindTaskAction = action("tasks.remind", async (ctx, form) => {
  await remind(ctx, str(form, "id"));
  revalidatePath("/app/tasks");
});

/** Remind everyone whose follow-up is due tomorrow and has not been reminded yet. */
export const remindTomorrowAction = formAction("tasks.remindTomorrow", async (ctx) => {
  const tasks = await ctx.db.task.findMany({
    where: { status: "OPEN", dueOn: addDays(istDate(), 1), remindedAt: null, contactId: { not: null } },
  });
  let sent = 0;
  for (const t of tasks) if (await remind(ctx, t.id)) sent++;
  revalidatePath("/app/tasks");
  return { ok: `Sent ${sent} reminder(s).` };
});

export const setTaskStatusAction = action("tasks.setStatus", async (ctx, form) => {
  const status = str(form, "status");
  if (status !== "DONE" && status !== "CANCELLED" && status !== "OPEN") throw new UserError("Invalid status.");
  await ctx.db.task.updateMany({ where: { id: str(form, "id") }, data: { status } });
  revalidatePath("/app/tasks");
});

/** Create a to-do, optionally for a contact and/or linked to an app record (refType + refId). */
export const createTaskAction = formAction("tasks.create", async (ctx, form) => {
  const title = str(form, "title");
  const dueOn = parseDateInput(str(form, "dueOn"));
  if (!title || !dueOn) throw new UserError("Add a title and a due date.");
  const contactId = optStr(form, "contactId");
  if (contactId && !(await ctx.db.contact.findFirst({ where: { id: contactId } }))) throw new UserError("Unknown contact.");
  const refType = optStr(form, "refType");
  const refId = optStr(form, "refId");
  await ctx.db.task.create({
    data: { orgId: ctx.org.id, title: title.slice(0, 200), dueOn, contactId, refType: refId ? refType : null, refId: refType ? refId : null },
  });
  revalidatePath("/app", "layout");
  return { ok: "Added." };
});
