package com.arcus.platform.spi;

/** A customer-facing message in English and Hindi, with {{placeholders}}. Both languages are required. */
public record Template(String en, String hi) {

    public String in(String lang) {
        return "hi".equals(lang) ? hi : en;
    }
}
