"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { str } from "@/lib/form";
import { requireCtx } from "@/core/auth";
import { deliver } from "@/core/messaging";

/** Send a failed message again as a new Outbox entry, keeping the failed one for the record. */
export async function retryMessageAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const msg = await db.message.findFirst({ where: { id: str(form, "id"), orgId: ctx.org.id, status: "FAILED" }, include: { contact: true } });
  if (msg?.contact) await deliver(ctx.org.id, msg.contact, msg.template, msg.body);
  revalidatePath("/app/messages");
}
