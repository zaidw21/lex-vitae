package com.arcus.platform.channels;

import com.arcus.platform.kernel.ArcusProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Picks the WhatsApp provider from configuration. Add providers here; nothing else changes. */
@Configuration(proxyBeanMethods = false)
public class ChannelConfig {

    @Bean
    public MessageChannel whatsappChannel(ArcusProperties props) {
        ArcusProperties.WhatsApp wa = props.whatsapp();
        return switch (wa.provider()) {
            case "meta" -> new MetaWhatsAppChannel(wa.metaToken(), wa.metaPhoneNumberId());
            case "log" -> new LogChannel();
            default -> throw new IllegalStateException("Unknown WhatsApp provider: " + wa.provider());
        };
    }
}
