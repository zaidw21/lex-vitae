"use server";

import { redirect } from "next/navigation";
import { UserError } from "@/platform/lib/errors";
import { str } from "@/platform/lib/form";
import { appUrl } from "@/platform/lib/url";
import { action } from "@/platform/kernel/actions";
import { notify } from "@/platform/services/messaging";

export const resendDocumentAction = action("documents.resend", async (ctx, form) => {
  const doc = await ctx.db.document.findFirst({ where: { id: str(form, "id") }, include: { contact: true } });
  if (!doc) throw new UserError("Document not found.");
  await notify(ctx, doc.contact, "DOCUMENT_SHARED", { link: appUrl(`/d/${doc.publicCode}`) });
  redirect(`/app/documents/${doc.id}?sent=1`);
});
