import type { MessageChannel } from "../types";

/**
 * WhatsApp Business Cloud API. Free-form text only reaches people who messaged the business in the
 * last 24 hours; outside that window Meta requires pre-approved templates (see docs/STRATEGY.md).
 */
export function metaWhatsApp(opts: { token?: string; phoneNumberId?: string }): MessageChannel {
  return {
    channel: "whatsapp",
    provider: "meta",
    async send(to, body) {
      if (!opts.token || !opts.phoneNumberId) return { ok: false, error: "META_WA_TOKEN / META_WA_PHONE_NUMBER_ID not set" };
      try {
        const res = await fetch(`https://graph.facebook.com/v21.0/${opts.phoneNumberId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: to.replace(/^\+/, ""), type: "text", text: { body, preview_url: true } }),
        });
        const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
        if (!res.ok) return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
        return { ok: true, ref: json.messages?.[0]?.id };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : "Network error" };
      }
    },
  };
}
