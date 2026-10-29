"use server";

import { redirect } from "next/navigation";
import { api } from "@/platform/api/client";
import { str } from "@/platform/lib/form";
import { action } from "@/platform/kernel/actions";

export const resendDocumentAction = action("documents.share", async (_ctx, form) => {
  const id = str(form, "id");
  await api.post(`/api/documents/${id}/share`);
  redirect(`/app/documents/${id}?sent=1`);
});
