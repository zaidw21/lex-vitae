package com.arcus.platform.channels;

/** One way of reaching a person (WhatsApp, SMS, email...). Apps never call providers directly. */
public interface MessageChannel {

    /** e.g. "WHATSAPP" */
    String channel();

    /** Provider name recorded on every message, e.g. "meta" or "log". */
    String provider();

    SendResult send(String toE164, String body);

    record SendResult(boolean ok, String ref, String error) {
        public static SendResult ok(String ref) {
            return new SendResult(true, ref, null);
        }

        public static SendResult failed(String error) {
            return new SendResult(false, null, error);
        }
    }
}
