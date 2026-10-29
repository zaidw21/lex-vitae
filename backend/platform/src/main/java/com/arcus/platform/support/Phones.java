package com.arcus.platform.support;

import java.util.Optional;

public final class Phones {

    private Phones() {
    }

    /** Normalize an Indian mobile number to E.164 (+91XXXXXXXXXX); empty when it isn't a plausible mobile. */
    public static Optional<String> normalize(String input) {
        if (input == null) return Optional.empty();
        String digits = input.replaceAll("\\D", "");
        if (digits.length() == 12 && digits.startsWith("91")) digits = digits.substring(2);
        else if (digits.length() == 11 && digits.startsWith("0")) digits = digits.substring(1);
        if (!digits.matches("[6-9]\\d{9}")) return Optional.empty();
        return Optional.of("+91" + digits);
    }
}
