"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { api } from "@/platform/api/client";
import { int, optStr, str } from "@/platform/lib/form";
import { contactInput } from "@/platform/lib/contact-input";
import { action, formAction } from "@/platform/kernel/actions";

export const bookAppointmentAction = formAction("appointments.book", async (_ctx, form) => {
  const contactId = optStr(form, "contactId");
  const date = str(form, "date");
  await api.post("/api/modules/appointments", {
    contactId,
    contact: contactId ? null : contactInput(form),
    date,
    time: str(form, "time"),
    providerId: optStr(form, "providerId"),
    durationMin: int(form, "durationMin", 15),
    source: str(form, "source"),
    notes: optStr(form, "notes"),
  });
  redirect(`/app/appointments?date=${date}`);
});

export const appointmentStatusAction = action("appointments.setStatus", async (_ctx, form) => {
  const status = str(form, "status");
  await api.post(`/api/modules/appointments/${str(form, "id")}/status`, { status });
  if (status === "CHECKED_IN") redirect("/app/queue");
  revalidatePath("/app/appointments");
});
