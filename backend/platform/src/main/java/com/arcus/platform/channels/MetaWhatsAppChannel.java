package com.arcus.platform.channels;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;

/**
 * WhatsApp Business Cloud API. Free-form text only reaches people who messaged the business in the last
 * 24 hours; outside that window Meta requires pre-approved templates (see docs/STRATEGY.md).
 */
public class MetaWhatsAppChannel implements MessageChannel {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final String token;
    private final String phoneNumberId;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public MetaWhatsAppChannel(String token, String phoneNumberId) {
        this.token = token;
        this.phoneNumberId = phoneNumberId;
    }

    @Override
    public String channel() {
        return "WHATSAPP";
    }

    @Override
    public String provider() {
        return "meta";
    }

    @Override
    public SendResult send(String toE164, String body) {
        if (token == null || token.isBlank() || phoneNumberId == null || phoneNumberId.isBlank()) {
            return SendResult.failed("WhatsApp is not configured (ARCUS_WHATSAPP_META_TOKEN / ARCUS_WHATSAPP_META_PHONE_NUMBER_ID)");
        }
        try {
            String payload = JSON.writeValueAsString(Map.of(
                    "messaging_product", "whatsapp",
                    "to", toE164.replaceFirst("^\\+", ""),
                    "type", "text",
                    "text", Map.of("body", body, "preview_url", true)));
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://graph.facebook.com/v21.0/" + phoneNumberId + "/messages"))
                    .timeout(Duration.ofSeconds(15))
                    .header("Authorization", "Bearer " + token)
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            JsonNode json = response.body().isBlank() ? JSON.createObjectNode() : JSON.readTree(response.body());
            if (response.statusCode() / 100 != 2) {
                String message = json.path("error").path("message").asString("HTTP " + response.statusCode());
                return SendResult.failed(message);
            }
            return SendResult.ok(json.path("messages").path(0).path("id").asString(null));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return SendResult.failed("Interrupted");
        } catch (Exception e) {
            return SendResult.failed(e.getMessage() == null ? "Network error" : e.getMessage());
        }
    }
}
