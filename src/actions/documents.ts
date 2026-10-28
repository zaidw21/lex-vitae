"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { str } from "@/lib/form";
import { appUrl } from "@/lib/url";
import { requireCtx } from "@/core/auth";
import { notify } from "@/core/messaging";

export async function resendDocumentAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const doc = await db.document.findFirst({ where: { id: str(form, "id"), orgId: ctx.org.id }, include: { contact: true } });
  if (!doc) throw new Error("Document not found.");
  await notify(ctx, doc.contact, "DOCUMENT_SHARED", { link: appUrl(`/d/${doc.publicCode}`) });
  redirect(`/app/documents/${doc.id}?sent=1`);
}
