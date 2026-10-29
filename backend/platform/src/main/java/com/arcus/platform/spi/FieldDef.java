package com.arcus.platform.spi;

import java.util.List;

/** @param type "text", "textarea" or "select" */
public record FieldDef(String key, String label, String type, List<String> options, String placeholder) {

    public static FieldDef text(String key, String label, String placeholder) {
        return new FieldDef(key, label, "text", null, placeholder);
    }

    public static FieldDef select(String key, String label, List<String> options) {
        return new FieldDef(key, label, "select", options, null);
    }
}
