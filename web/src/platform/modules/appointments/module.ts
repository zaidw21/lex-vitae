import type { ModuleUi } from "@/platform/kernel/types";
import { BookAppointmentLink } from "./contact-action";

/** UI of the appointments module (backend: com.arcus.platform.modules.appointments). */
export const appointmentsModule: ModuleUi = {
  id: "appointments",
  nav: [{ href: "/app/appointments", label: "Appointments", icon: "🗓️" }],
  contactActions: BookAppointmentLink,
};
