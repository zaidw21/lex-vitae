import type { ModuleUi } from "@/platform/kernel/types";
import { GiveTokenButton } from "./contact-action";
import { QueueSettings } from "./settings";
import { QueueWidget } from "./widget";

/** UI of the queue module (backend: com.arcus.platform.modules.queue). */
export const queueModule: ModuleUi = {
  id: "queue",
  nav: [{ href: "/app/queue", label: "Queue", icon: "🎫" }],
  widgets: [QueueWidget],
  contactActions: GiveTokenButton,
  settingsSections: [QueueSettings],
};
