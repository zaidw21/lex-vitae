"use server";

import { revalidatePath } from "next/cache";
import { api } from "@/platform/api/client";
import { str } from "@/platform/lib/form";
import { action } from "@/platform/kernel/actions";

/** Send a failed message again as a new outbox entry, keeping the failed one for the record. */
export const retryMessageAction = action("messages.retry", async (_ctx, form) => {
  await api.post(`/api/messages/${str(form, "id")}/retry`);
  revalidatePath("/app/messages");
});
