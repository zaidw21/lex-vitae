import type { AppUi } from "@/platform/kernel/types";
import { StartConsultationLink } from "./components/contact-action";
import { PrescriptionSheet } from "./components/prescription-sheet";
import { ClinicSettings } from "./components/settings";

/** UI of Arcus Clinic (backend: backend/apps/clinic). */
export const clinicUi: AppUi = {
  contactActions: StartConsultationLink,
  queue: { startHref: (entryId) => `/app/consult?entry=${entryId}`, startLabel: "Open consultation" },
  documentRenderers: { PRESCRIPTION: PrescriptionSheet },
  settingsSections: [ClinicSettings],
};
