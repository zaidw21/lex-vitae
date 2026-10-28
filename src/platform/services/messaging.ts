import type { Contact } from "@prisma/client";
import { whatsapp } from "@/platform/channels";
import { db } from "@/platform/lib/db";
import { log } from "@/platform/telemetry/logger";
import type { Ctx } from "@/platform/kernel/auth";
import { MODULES } from "@/platform/kernel/modules";
import { messageText, PLATFORM_MESSAGES } from "./templates";

type Recipient = Pick<Contact, "id" | "name" | "phone" | "preferredLang" | "whatsappOptIn">;

/**
 * Send a templated WhatsApp message to a contact, in their preferred language.
 * Never throws: failures are recorded on the Message row so staff can see and retry them.
 */
export async function notify(
  ctx: Pick<Ctx, "org" | "app" | "modules">,
  contact: Recipient,
  key: string,
  vars: Record<string, string | number>,
): Promise<void> {
  const sources = [ctx.app.messages, ...ctx.modules.map((m) => MODULES[m].messages), PLATFORM_MESSAGES];
  const body = messageText(sources, key, contact.preferredLang, { name: contact.name, org: ctx.org.name, ...vars });
  if (!body) {
    log.warn("message.template_missing", { key });
    return;
  }
  await deliver(ctx.org.id, contact, key, body);
}

/** Record a message in the Outbox and hand it to the configured provider. */
export async function deliver(
  orgId: string,
  contact: Pick<Contact, "id" | "phone" | "whatsappOptIn">,
  template: string,
  body: string,
): Promise<void> {
  const channel = whatsapp();
  const message = await db.message.create({
    data: { orgId, contactId: contact.id, to: contact.phone, template, body, provider: channel.provider, channel: "WHATSAPP" },
  });
  if (!contact.whatsappOptIn) {
    await db.message.update({ where: { id: message.id }, data: { status: "FAILED", error: "Not opted in to WhatsApp" } });
    return;
  }
  const result = await channel.send(contact.phone, body);
  if (!result.ok) log.warn("message.failed", { template, provider: channel.provider, error: result.error });
  await db.message.update({
    where: { id: message.id },
    data: result.ok ? { status: "SENT", providerRef: result.ref } : { status: "FAILED", error: result.error },
  });
}
