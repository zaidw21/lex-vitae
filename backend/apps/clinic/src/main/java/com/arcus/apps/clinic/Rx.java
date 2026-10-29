package com.arcus.apps.clinic;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Prescription line items. Validation lives here; Hindi/English wording is rendered by the web app. */
public final class Rx {

    public static final List<String> FREQUENCIES = List.of("1-0-1", "1-1-1", "1-0-0", "0-0-1", "0-1-0", "1-1-0", "0-1-1", "1-1-1-1", "SOS", "STAT", "Weekly");
    public static final Set<String> TIMINGS = Set.of("AFTER_FOOD", "BEFORE_FOOD", "EMPTY_STOMACH", "BEDTIME", "ANY");

    private Rx() {
    }

    public record Item(String name, String dose, String frequency, String timing, Integer days, String note) {
    }

    /** Clean untrusted items from the browser: drop nameless ones, clamp lengths, default unknown values. */
    public static List<Item> sanitize(List<Map<String, Object>> raw) {
        List<Item> out = new ArrayList<>();
        if (raw == null) return out;
        for (Map<String, Object> r : raw) {
            if (r == null || out.size() >= 30) continue;
            String name = clip(r.get("name"), 120);
            if (name == null) continue;
            String frequency = clip(r.get("frequency"), 20);
            String timing = r.get("timing") instanceof String t && TIMINGS.contains(t) ? t : "AFTER_FOOD";
            Integer days = r.get("days") instanceof Number n && n.intValue() > 0 && n.intValue() <= 365 ? n.intValue() : null;
            out.add(new Item(name, clip(r.get("dose"), 40), frequency == null ? "1-0-1" : frequency, timing, days, clip(r.get("note"), 200)));
        }
        return out;
    }

    private static String clip(Object value, int max) {
        if (!(value instanceof String s) || s.isBlank()) return null;
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    /** Catalog data for a favourite medicine (everything but the name). */
    public static Map<String, Object> favouriteData(Item m) {
        Map<String, Object> data = new LinkedHashMap<>();
        if (m.dose() != null) data.put("dose", m.dose());
        data.put("frequency", m.frequency());
        data.put("timing", m.timing());
        if (m.days() != null) data.put("days", m.days());
        return data;
    }

    /** Starter favourites for a new clinic, editable in Settings. */
    public static final List<Item> STARTER_MEDICINES = List.of(
            new Item("Tab. Paracetamol 650", "1 tab", "1-1-1", "AFTER_FOOD", 3, null),
            new Item("Tab. Pantoprazole 40", "1 tab", "1-0-0", "EMPTY_STOMACH", 5, null),
            new Item("Tab. Cetirizine 10", "1 tab", "0-0-1", "BEDTIME", 5, null),
            new Item("Cap. Amoxicillin 500", "1 cap", "1-1-1", "AFTER_FOOD", 5, null),
            new Item("Tab. Azithromycin 500", "1 tab", "1-0-0", "AFTER_FOOD", 3, null),
            new Item("Syp. Ambroxol", "5 ml", "1-1-1", "AFTER_FOOD", 5, null),
            new Item("ORS sachet", "1 sachet in 1 L water", "SOS", "ANY", null, null),
            new Item("Tab. Metformin 500", "1 tab", "1-0-1", "AFTER_FOOD", 30, null),
            new Item("Tab. Amlodipine 5", "1 tab", "1-0-0", "ANY", 30, null),
            new Item("Tab. Ondansetron 4", "1 tab", "SOS", "BEFORE_FOOD", null, null));
}
