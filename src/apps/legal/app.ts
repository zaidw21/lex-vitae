import type { AppManifest } from "@/platform/kernel/types";
import { MattersSection, NewMatterLink } from "./components/contact-slots";
import { LegalWidget } from "./components/widget";
import { legalConfig } from "./config";

export const legalApp: AppManifest = {
  ...legalConfig,
  nav: [
    { href: "/app/hearings", label: "Hearing diary", icon: "📅" },
    { href: "/app/matters", label: "Matters", icon: "📁" },
  ],
  widgets: [LegalWidget],
  contactActions: NewMatterLink,
  contactSections: MattersSection,
};
