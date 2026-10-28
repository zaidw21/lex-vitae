"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { fail, type FormState } from "@/lib/form-state";
import { optStr, str } from "@/lib/form";
import { addDays, formatDate, istDate, parseDateInput } from "@/lib/time";
import { requireCtx, type Ctx } from "@/core/auth";
import { notify } from "@/core/messaging";

async function remind(ctx: Ctx, taskId: string): Promise<boolean> {
  const task = await db.task.findFirst({ where: { id: taskId, orgId: ctx.org.id }, include: { contact: true } });
  if (!task?.contact || task.status !== "OPEN") return false;
  await notify(ctx, task.contact, "FOLLOW_UP_REMINDER", { date: formatDate(task.dueOn), title: task.title });
  await db.task.update({ where: { id: task.id }, data: { remindedAt: new Date() } });
  return true;
}

export async function remindTaskAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  await remind(ctx, str(form, "id"));
  revalidatePath("/app/tasks");
}

/** Remind everyone whose follow-up is due tomorrow and has not been reminded yet. */
export async function remindTomorrowAction(_: FormState): Promise<FormState> {
  try {
    const ctx = await requireCtx();
    const tasks = await db.task.findMany({
      where: { orgId: ctx.org.id, status: "OPEN", dueOn: addDays(istDate(), 1), remindedAt: null, contactId: { not: null } },
    });
    let sent = 0;
    for (const t of tasks) if (await remind(ctx, t.id)) sent++;
    revalidatePath("/app/tasks");
    return { ok: `Sent ${sent} reminder(s).` };
  } catch (err) {
    return fail(err);
  }
}

export async function setTaskStatusAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const status = str(form, "status");
  if (status !== "DONE" && status !== "CANCELLED" && status !== "OPEN") throw new Error("Invalid status.");
  await db.task.updateMany({ where: { id: str(form, "id"), orgId: ctx.org.id }, data: { status } });
  revalidatePath("/app/tasks");
}

export async function createTaskAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const ctx = await requireCtx();
    const title = str(form, "title");
    const dueOn = parseDateInput(str(form, "dueOn"));
    if (!title || !dueOn) return { error: "Add a title and a due date." };
    const contactId = optStr(form, "contactId");
    if (contactId && !(await db.contact.findFirst({ where: { id: contactId, orgId: ctx.org.id } }))) throw new Error("Unknown contact.");
    const matterId = optStr(form, "matterId");
    if (matterId && !(await db.matter.findFirst({ where: { id: matterId, orgId: ctx.org.id } }))) throw new Error("Unknown matter.");
    await db.task.create({ data: { orgId: ctx.org.id, title: title.slice(0, 200), dueOn, contactId, matterId } });
    revalidatePath("/app/tasks");
    if (matterId) revalidatePath(`/app/matters/${matterId}`);
    return { ok: "Added." };
  } catch (err) {
    return fail(err);
  }
}
