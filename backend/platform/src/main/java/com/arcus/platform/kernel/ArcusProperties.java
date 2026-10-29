package com.arcus.platform.kernel;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * All Arcus configuration, bound from {@code arcus.*} properties / {@code ARCUS_*} environment variables.
 *
 * @param appUrl            public base URL of the web app, used in WhatsApp links
 * @param sessionDays       how long a login lasts
 * @param whatsapp          WhatsApp provider settings
 * @param allowRlsBypassRole allow connecting as a role that bypasses row-level security (never in production)
 */
@ConfigurationProperties("arcus")
public record ArcusProperties(String appUrl, Integer sessionDays, WhatsApp whatsapp, boolean allowRlsBypassRole) {

    public ArcusProperties {
        if (appUrl == null || appUrl.isBlank()) appUrl = "http://localhost:3000";
        appUrl = appUrl.replaceAll("/+$", "");
        if (sessionDays == null) sessionDays = 30;
        if (whatsapp == null) whatsapp = new WhatsApp(null, null, null);
    }

    /** @param provider "log" (record only, default) or "meta" (WhatsApp Business Cloud API) */
    public record WhatsApp(String provider, String metaToken, String metaPhoneNumberId) {
        public WhatsApp {
            if (provider == null || provider.isBlank()) provider = "log";
        }
    }

    public String link(String path) {
        return appUrl + (path.startsWith("/") ? path : "/" + path);
    }
}
