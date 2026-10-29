package com.arcus.platform.support;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;

/** JSON for jsonb columns. Values are stored as JSON text and bound with {@code ?::jsonb}. */
public final class Json {

    private static final JsonMapper MAPPER = JsonMapper.builder().build();

    private Json() {
    }

    public static String write(Object value) {
        return MAPPER.writeValueAsString(value == null ? Map.of() : value);
    }

    public static Map<String, Object> map(String json) {
        if (json == null || json.isBlank()) return Map.of();
        return MAPPER.readValue(json, new TypeReference<Map<String, Object>>() {
        });
    }

    public static List<Object> list(String json) {
        if (json == null || json.isBlank()) return List.of();
        return MAPPER.readValue(json, new TypeReference<List<Object>>() {
        });
    }
}
