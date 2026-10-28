"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, type FormState } from "@/lib/form-state";
import { int, optStr, str } from "@/lib/form";
import { formatDateTime, parseIstDateTime } from "@/lib/time";
import { requireCtx } from "@/core/auth";
import { findContact, findOrCreateContact } from "@/core/contacts";
import { notify } from "@/core/messaging";
import { requireModule } from "@/core/modules";
import { issueToken } from "@/core/queue";

export async function bookAppointmentAction(_: FormState, form: FormData): Promise<FormState> {
  let date: string;
  try {
    const ctx = await requireCtx();
    requireModule(ctx, "appointments");
    const contactId = str(form, "contactId");
    const contact = contactId ? await findContact(ctx, contactId) : await findOrCreateContact(ctx, form);
    if (!contact) throw new Error("Unknown contact.");
    date = str(form, "date");
    const startsAt = parseIstDateTime(date, str(form, "time"));
    if (!startsAt) throw new Error("Please pick a date and time.");
    const providerId = optStr(form, "providerId");
    if (providerId && !(await db.membership.findFirst({ where: { id: providerId, orgId: ctx.org.id } }))) {
      throw new Error("Unknown practitioner.");
    }
    await db.appointment.create({
      data: {
        orgId: ctx.org.id,
        contactId: contact.id,
        providerId,
        startsAt,
        durationMin: Math.min(Math.max(int(form, "durationMin", 15), 5), 240),
        source: str(form, "source") || "PHONE",
        notes: optStr(form, "notes"),
      },
    });
    await notify(ctx, contact, "APPOINTMENT_BOOKED", { when: formatDateTime(startsAt), address: ctx.org.address ?? ctx.org.city ?? "" });
  } catch (err) {
    return fail(err);
  }
  redirect(`/app/appointments?date=${date}`);
}

export async function appointmentStatusAction(form: FormData): Promise<void> {
  const ctx = await requireCtx();
  const appt = await db.appointment.findFirst({ where: { id: str(form, "id"), orgId: ctx.org.id } });
  if (!appt) throw new Error("Appointment not found.");
  const status = str(form, "status") as AppointmentStatus;
  if (status === "CHECKED_IN") {
    requireModule(ctx, "queue");
    await issueToken(ctx, { contactId: appt.contactId, providerId: appt.providerId, appointmentId: appt.id });
    redirect("/app/queue");
  }
  if (!["COMPLETED", "CANCELLED", "NO_SHOW", "BOOKED"].includes(status)) throw new Error("Invalid status.");
  await db.appointment.update({ where: { id: appt.id }, data: { status } });
  revalidatePath("/app/appointments");
}
