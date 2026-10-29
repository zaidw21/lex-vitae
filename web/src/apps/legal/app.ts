import type { AppUi } from "@/platform/kernel/types";
import { MattersSection, NewMatterLink } from "./components/contact-slots";
import { LegalWidget } from "./components/widget";

/** UI of Arcus Legal (backend: backend/apps/legal). */
export const legalUi: AppUi = {
  nav: [
    { href: "/app/hearings", label: "Hearing diary", icon: "📅" },
    { href: "/app/matters", label: "Matters", icon: "📁" },
  ],
  widgets: [LegalWidget],
  contactActions: NewMatterLink,
  contactSections: MattersSection,
};
