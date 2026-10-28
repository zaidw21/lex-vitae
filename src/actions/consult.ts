"use server";

import { redirect } from "next/navigation";
import { fail, type FormState } from "@/lib/form-state";
import { optStr, str } from "@/lib/form";
import { rupeesToPaise } from "@/lib/money";
import { requireCtx } from "@/core/auth";
import { saveConsultation } from "@/verticals/clinic/consultation";
import { sanitizeRxItems } from "@/verticals/clinic/rx";

export async function saveConsultationAction(_: FormState, form: FormData): Promise<FormState> {
  let documentId: string;
  try {
    const ctx = await requireCtx();
    if (ctx.org.vertical !== "CLINIC") throw new Error("Not available for this practice.");
    let items: unknown = [];
    try {
      items = JSON.parse(str(form, "items") || "[]");
    } catch {
      items = [];
    }
    const followUpDays = Number.parseInt(str(form, "followUpDays"), 10);
    const payment = str(form, "paymentMode");
    const { document } = await saveConsultation(ctx, {
      contactId: str(form, "contactId"),
      queueEntryId: optStr(form, "entryId"),
      vitals: {
        bp: str(form, "bp"),
        pulse: str(form, "pulse"),
        temp: str(form, "temp"),
        spo2: str(form, "spo2"),
        weight: str(form, "weight"),
        sugar: str(form, "sugar"),
      },
      complaints: str(form, "complaints"),
      findings: str(form, "findings"),
      diagnosis: str(form, "diagnosis"),
      advice: str(form, "advice"),
      items: sanitizeRxItems(items),
      followUpDays: Number.isInteger(followUpDays) && followUpDays > 0 ? followUpDays : null,
      fee: form.get("bill") === "on" ? rupeesToPaise(str(form, "fee")) : null,
      paymentMode: payment === "CASH" || payment === "UPI" || payment === "CARD" ? payment : null,
      sendWhatsApp: form.get("sendWhatsApp") === "on",
    });
    documentId = document.id;
  } catch (err) {
    return fail(err);
  }
  redirect(`/app/documents/${documentId}?saved=1`);
}
