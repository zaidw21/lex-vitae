"use server";

import { redirect } from "next/navigation";
import { int, optStr, str } from "@/platform/lib/form";
import { rupeesToPaise } from "@/platform/lib/money";
import { formAction } from "@/platform/kernel/actions";
import { requireApp } from "@/platform/kernel/modules";
import { addCatalogItem, mergeOrgSettings } from "@/platform/services/settings";
import { saveConsultation } from "./consultation";
import { FREQUENCIES, sanitizeRxItems, TIMINGS } from "./rx";

export const saveConsultationAction = formAction("clinic.saveConsultation", async (ctx, form) => {
  requireApp(ctx, "clinic");
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
  redirect(`/app/documents/${document.id}?saved=1`);
});

export const updateClinicFeesAction = formAction("clinic.updateFees", async (ctx, form) => {
  requireApp(ctx, "clinic");
  await mergeOrgSettings(ctx, {
    consultationFee: Math.max(0, int(form, "consultationFee", 0)),
    followUpFee: Math.max(0, int(form, "followUpFee", 0)),
    followUpFreeDays: Math.max(0, int(form, "followUpFreeDays", 7)),
  });
  return { ok: "Saved." };
});

export const addMedicineAction = formAction("clinic.addMedicine", async (ctx, form) => {
  requireApp(ctx, "clinic");
  const frequency = str(form, "frequency");
  const timing = str(form, "timing");
  const days = int(form, "days", 0);
  await addCatalogItem(ctx, {
    kind: "MEDICINE",
    name: str(form, "name"),
    data: {
      ...(optStr(form, "dose") ? { dose: optStr(form, "dose") } : {}),
      frequency: FREQUENCIES.includes(frequency) ? frequency : "1-0-1",
      timing: TIMINGS.some((t) => t.value === timing) ? timing : "AFTER_FOOD",
      ...(days > 0 ? { days } : {}),
    },
  });
  return { ok: "Added." };
});
