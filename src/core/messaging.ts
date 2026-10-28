import type { Contact } from "@prisma/client";
import { db } from "@/lib/db";
import type { MessageKey } from "@/verticals/types";
import type { Ctx } from "./auth";
import { messageText } from "./templates";

interface ProviderResult {
  ok: boolean;
  ref?: string;
  error?: string;
}

interface WhatsAppProvider {
  name: string;
  send(to: string, body: string): Promise<ProviderResult>;
}

/** Records the message in the Outbox without sending. The default until a provider is configured. */
const logProvider: WhatsAppProvider = {
  name: "log",
  async send() {
    return { ok: true };
  },
};

/**
 * WhatsApp Business Cloud API. Free-form text only reaches users who messaged the business in the
 * last 24 hours; outside that window Meta requires pre-approved templates (see README).
 */
const metaProvider: WhatsAppProvider = {
  name: "meta",
  async send(to, body) {
    const token = process.env.META_WA_TOKEN;
    const phoneId = process.env.META_WA_PHONE_NUMBER_ID;
    if (!token || !phoneId) return { ok: false, error: "META_WA_TOKEN / META_WA_PHONE_NUMBER_ID not set" };
    try {
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: to.replace(/^\+/, ""),
          type: "text",
          text: { body, preview_url: true },
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
      if (!res.ok) return { ok: false, error: json.error?.message ?? `HTTP ${res.status}` };
      return { ok: true, ref: json.messages?.[0]?.id };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  },
};

function provider(): WhatsAppProvider {
  return process.env.WHATSAPP_PROVIDER === "meta" ? metaProvider : logProvider;
}

/**
 * Send a templated WhatsApp message to a contact, in their preferred language.
 * Never throws: failures are recorded on the Message row so staff can see and retry them.
 */
export async function notify(
  ctx: Pick<Ctx, "org" | "pack">,
  contact: Pick<Contact, "id" | "name" | "phone" | "preferredLang" | "whatsappOptIn">,
  key: MessageKey,
  vars: Record<string, string | number>,
): Promise<void> {
  const body = messageText(ctx.pack, key, contact.preferredLang, { name: contact.name, org: ctx.org.name, ...vars });
  if (body) await deliver(ctx.org.id, contact, key, body);
}

/** Record a message in the Outbox and hand it to the configured provider. */
export async function deliver(
  orgId: string,
  contact: Pick<Contact, "id" | "phone" | "whatsappOptIn">,
  template: string,
  body: string,
): Promise<void> {
  const p = provider();
  const message = await db.message.create({
    data: { orgId, contactId: contact.id, to: contact.phone, template, body, provider: p.name },
  });
  if (!contact.whatsappOptIn) {
    await db.message.update({ where: { id: message.id }, data: { status: "FAILED", error: "Not opted in to WhatsApp" } });
    return;
  }
  const result = await p.send(contact.phone, body);
  await db.message.update({
    where: { id: message.id },
    data: result.ok ? { status: "SENT", providerRef: result.ref } : { status: "FAILED", error: result.error },
  });
}
