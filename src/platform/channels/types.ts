/** One way of reaching a person (WhatsApp, SMS, email...). Apps never call providers directly. */
export interface MessageChannel {
  channel: "whatsapp" | "sms";
  /** Provider name, recorded on every message (e.g. "meta", "log"). */
  provider: string;
  send(to: string, body: string): Promise<SendResult>;
}

export interface SendResult {
  ok: boolean;
  ref?: string;
  error?: string;
}
