"use server";

import { redirect } from "next/navigation";
import { api } from "@/platform/api/client";
import type { DocumentRecord } from "@/platform/api/types";
import { int, optStr, str } from "@/platform/lib/form";
import { formAction } from "@/platform/kernel/actions";
import { revalidatePath } from "next/cache";

export const saveConsultationAction = formAction("clinic.saveConsultation", async (_ctx, form) => {
  let items: unknown = [];
  try {
    items = JSON.parse(str(form, "items") || "[]");
  } catch {
    items = [];
  }
  const followUpDays = Number.parseInt(str(form, "followUpDays"), 10);
  const doc = await api.post<DocumentRecord>("/api/apps/clinic/consultations", {
    contactId: str(form, "contactId"),
    entryId: optStr(form, "entryId"),
    vitals: Object.fromEntries(["bp", "pulse", "temp", "spo2", "weight", "sugar"].map((k) => [k, str(form, k)])),
    complaints: str(form, "complaints"),
    findings: str(form, "findings"),
    diagnosis: str(form, "diagnosis"),
    advice: str(form, "advice"),
    items,
    followUpDays: Number.isInteger(followUpDays) && followUpDays > 0 ? followUpDays : null,
    bill: form.get("bill") === "on",
    fee: str(form, "fee"),
    paymentMode: optStr(form, "paymentMode"),
    sendWhatsApp: form.get("sendWhatsApp") === "on",
  });
  redirect(`/app/documents/${doc.id}?saved=1`);
});

export const updateClinicFeesAction = formAction("clinic.updateFees", async (_ctx, form) => {
  await api.put("/api/apps/clinic/settings", {
    consultationFee: int(form, "consultationFee", 0),
    followUpFee: int(form, "followUpFee", 0),
    followUpFreeDays: int(form, "followUpFreeDays", 7),
  });
  revalidatePath("/app/settings");
  return { ok: "Saved." };
});

export const addMedicineAction = formAction("clinic.addMedicine", async (_ctx, form) => {
  const days = int(form, "days", 0);
  await api.post("/api/apps/clinic/medicines", {
    name: str(form, "name"),
    dose: optStr(form, "dose"),
    frequency: str(form, "frequency"),
    timing: str(form, "timing"),
    ...(days > 0 ? { days } : {}),
  });
  revalidatePath("/app/settings");
  return { ok: "Added." };
});
