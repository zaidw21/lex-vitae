package com.arcus.platform.spi;

/** The words an app uses for platform concepts ("Patient"/"Client", "Consultation"/"Hearing"...). */
public record Terms(String practice, String contact, String contacts, String practitioner, String encounter, String encounters) {
}
