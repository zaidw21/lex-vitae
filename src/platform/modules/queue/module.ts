import type { ModuleManifest } from "@/platform/kernel/types";
import { GiveTokenButton } from "./contact-action";
import { QueueSettings } from "./settings";
import { QueueWidget } from "./widget";

export const queueModule: ModuleManifest = {
  id: "queue",
  name: "Live queue",
  description: "Walk-in tokens, live status on WhatsApp, waiting-room screen.",
  nav: [{ href: "/app/queue", label: "Queue", icon: "🎫" }],
  widgets: [QueueWidget],
  contactActions: GiveTokenButton,
  settingsSections: [QueueSettings],
  messages: {
    TOKEN_ISSUED: {
      en: "Namaste {{name}}, your token at {{org}} is #{{token}}. {{ahead}} ahead of you. Track your turn live: {{link}}",
      hi: "नमस्ते {{name}}, {{org}} में आपका टोकन नंबर #{{token}} है। आपसे पहले {{ahead}} लोग हैं। अपनी बारी यहाँ देखें: {{link}}",
    },
    TURN_NEAR: {
      en: "{{name}}, your turn at {{org}} is coming up (token #{{token}}). Please stay close by.",
      hi: "{{name}}, {{org}} में आपकी बारी आने वाली है (टोकन #{{token}})। कृपया पास ही रहें।",
    },
    DELAY_NOTICE: {
      en: "{{org}}: We are running about {{minutes}} minutes late today. Sorry for the wait. Live status: {{link}}",
      hi: "{{org}}: आज हम लगभग {{minutes}} मिनट देरी से चल रहे हैं। असुविधा के लिए खेद है। लाइव स्थिति: {{link}}",
    },
  },
};
