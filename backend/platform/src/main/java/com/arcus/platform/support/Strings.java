package com.arcus.platform.support;

import java.util.Collection;
import java.util.List;

public final class Strings {

    private Strings() {
    }

    /** Null-safe membership test (List.of(...).contains(null) throws). */
    public static boolean oneOf(String value, Collection<String> options) {
        return value != null && options.contains(value);
    }

    public static boolean oneOf(String value, String... options) {
        return oneOf(value, List.of(options));
    }
}
