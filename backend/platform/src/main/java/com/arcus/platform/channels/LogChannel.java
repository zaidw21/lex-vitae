package com.arcus.platform.channels;

/** Test mode: messages are recorded in the outbox but not delivered. */
public class LogChannel implements MessageChannel {

    @Override
    public String channel() {
        return "WHATSAPP";
    }

    @Override
    public String provider() {
        return "log";
    }

    @Override
    public SendResult send(String toE164, String body) {
        return SendResult.ok(null);
    }
}
