"use server";

import { revalidatePath } from "next/cache";
import { str } from "@/platform/lib/form";
import { action } from "@/platform/kernel/actions";
import { deliver } from "@/platform/services/messaging";

/** Send a failed message again as a new Outbox entry, keeping the failed one for the record. */
export const retryMessageAction = action("messages.retry", async (ctx, form) => {
  const msg = await ctx.db.message.findFirst({ where: { id: str(form, "id"), status: "FAILED" }, include: { contact: true } });
  if (msg?.contact) await deliver(ctx.org.id, msg.contact, msg.template, msg.body);
  revalidatePath("/app/messages");
});
