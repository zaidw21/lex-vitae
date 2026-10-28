import type { ModuleManifest } from "@/platform/kernel/types";
import { BookAppointmentLink } from "./contact-action";

export const appointmentsModule: ModuleManifest = {
  id: "appointments",
  name: "Appointments",
  description: "Book, confirm on WhatsApp, check in, track no-shows.",
  nav: [{ href: "/app/appointments", label: "Appointments", icon: "🗓️" }],
  contactActions: BookAppointmentLink,
};
