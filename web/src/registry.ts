// Composition root for the UI: which app UIs this web build includes, keyed by the Java app id.
// Adding an app = its backend module (backend/apps/<id>) + its UI here (src/apps/<id>) + thin route files.
import { clinicUi } from "@/apps/clinic/app";
import { legalUi } from "@/apps/legal/app";
import type { AppUi } from "@/platform/kernel/types";

export const APP_UI: Record<string, AppUi> = {
  clinic: clinicUi,
  legal: legalUi,
};

/** The UI for an app id; an app without a registered UI still works with the platform screens. */
export function appUi(id: string): AppUi {
  return APP_UI[id] ?? {};
}
