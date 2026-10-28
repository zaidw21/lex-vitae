import type { MessageChannel } from "../types";

/** Test mode: the message is recorded in the Outbox but not delivered. */
export function logChannel(channel: MessageChannel["channel"]): MessageChannel {
  return {
    channel,
    provider: "log",
    async send() {
      return { ok: true };
    },
  };
}
