import { config } from "@/platform/kernel/config";
import { logChannel } from "./adapters/log";
import { metaWhatsApp } from "./adapters/meta-whatsapp";
import type { MessageChannel } from "./types";

/** The configured WhatsApp provider. Add providers in ./adapters and select them in config. */
export function whatsapp(): MessageChannel {
  const c = config();
  return c.WHATSAPP_PROVIDER === "meta"
    ? metaWhatsApp({ token: c.META_WA_TOKEN, phoneNumberId: c.META_WA_PHONE_NUMBER_ID })
    : logChannel("whatsapp");
}

export type { MessageChannel, SendResult } from "./types";
