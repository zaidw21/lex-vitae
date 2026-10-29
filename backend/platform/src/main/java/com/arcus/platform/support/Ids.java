package com.arcus.platform.support;

import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.Locale;

public final class Ids {

    private static final String ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
    private static final SecureRandom RANDOM = new SecureRandom();

    private Ids() {
    }

    /** Short, unguessable, unambiguous code for public links (token status, documents, receipts). */
    public static String publicCode() {
        StringBuilder out = new StringBuilder(10);
        for (int i = 0; i < 10; i++) out.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return out.toString();
    }

    public static String slugify(String input) {
        String s = Normalizer.normalize(input == null ? "" : input, Normalizer.Form.NFKD)
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return s.length() > 40 ? s.substring(0, 40).replaceAll("-+$", "") : s;
    }
}
