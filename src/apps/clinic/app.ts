import type { AppManifest } from "@/platform/kernel/types";
import { StartConsultationLink } from "./components/contact-action";
import { PrescriptionSheet } from "./components/prescription-sheet";
import { ClinicSettings } from "./components/settings";
import { clinicConfig } from "./config";

export const clinicApp: AppManifest = {
  ...clinicConfig,
  contactActions: StartConsultationLink,
  queue: { startHref: (entryId) => `/app/consult?entry=${entryId}`, startLabel: "Open consultation" },
  documentRenderers: { PRESCRIPTION: PrescriptionSheet },
  settingsSections: [ClinicSettings],
};
