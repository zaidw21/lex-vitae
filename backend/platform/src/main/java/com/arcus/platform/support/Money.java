package com.arcus.platform.support;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Money is stored as whole paise (long) everywhere. */
public final class Money {

    private Money() {
    }

    /** Parse a rupee amount typed by a user ("500", "1,250.50", "₹400") into paise; invalid or negative → 0. */
    public static long rupeesToPaise(String value) {
        if (value == null) return 0;
        String cleaned = value.replaceAll("[,₹\\s]", "");
        if (cleaned.isEmpty()) return 0;
        try {
            BigDecimal rupees = new BigDecimal(cleaned);
            if (rupees.signum() < 0) return 0;
            return rupees.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValueExact();
        } catch (NumberFormatException | ArithmeticException e) {
            return 0;
        }
    }

    /** "₹1,23,456" / "₹123.45" (Indian digit grouping). */
    public static String format(long paise) {
        long rupees = Math.abs(paise) / 100;
        long fraction = Math.abs(paise) % 100;
        String digits = Long.toString(rupees);
        StringBuilder grouped = new StringBuilder();
        int len = digits.length();
        if (len <= 3) {
            grouped.append(digits);
        } else {
            String head = digits.substring(0, len - 3);
            for (int i = 0; i < head.length(); i++) {
                if (i > 0 && (head.length() - i) % 2 == 0) grouped.append(',');
                grouped.append(head.charAt(i));
            }
            grouped.append(',').append(digits, len - 3, len);
        }
        return (paise < 0 ? "-₹" : "₹") + grouped + (fraction == 0 ? "" : String.format(".%02d", fraction));
    }
}
