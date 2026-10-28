"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { UserError } from "@/platform/lib/errors";
import { int, optStr, str } from "@/platform/lib/form";
import { formatDateTime, parseIstDateTime } from "@/platform/lib/time";
import { action, formAction } from "@/platform/kernel/actions";
import { requireModule } from "@/platform/kernel/modules";
import { issueToken } from "@/platform/modules/queue/service";
import { findContact, findOrCreateContact } from "@/platform/services/contacts";
import { notify } from "@/platform/services/messaging";

export const bookAppointmentAction = formAction("appointments.book", async (ctx, form) => {
  requireModule(ctx, "appointments");
  const contactId = str(form, "contactId");
  const contact = contactId ? await findContact(ctx, contactId) : await findOrCreateContact(ctx, form);
  if (!contact) throw new UserError("Unknown contact.");
  const date = str(form, "date");
  const startsAt = parseIstDateTime(date, str(form, "time"));
  if (!startsAt) throw new UserError("Please pick a date and time.");
  const providerId = optStr(form, "providerId");
  if (providerId && !(await ctx.db.membership.findFirst({ where: { id: providerId } }))) throw new UserError("Unknown practitioner.");
  await ctx.db.appointment.create({
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
  redirect(`/app/appointments?date=${date}`);
});

export const appointmentStatusAction = action("appointments.setStatus", async (ctx, form) => {
  requireModule(ctx, "appointments");
  const appt = await ctx.db.appointment.findFirst({ where: { id: str(form, "id") } });
  if (!appt) throw new UserError("Appointment not found.");
  const status = str(form, "status") as AppointmentStatus;
  if (status === "CHECKED_IN") {
    requireModule(ctx, "queue");
    await issueToken(ctx, { contactId: appt.contactId, providerId: appt.providerId, appointmentId: appt.id });
    redirect("/app/queue");
  }
  if (!["COMPLETED", "CANCELLED", "NO_SHOW", "BOOKED"].includes(status)) throw new UserError("Invalid status.");
  await ctx.db.appointment.update({ where: { id: appt.id }, data: { status } });
  revalidatePath("/app/appointments");
});
