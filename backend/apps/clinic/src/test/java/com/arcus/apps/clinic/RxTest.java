package com.arcus.apps.clinic;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RxTest {

    @Test
    void sanitizesUntrustedItems() {
        Map<String, Object> messy = new HashMap<>(Map.of("name", "  Tab. Y  ", "timing", "NOPE", "days", 9999));
        List<Map<String, Object>> raw = new ArrayList<>();
        raw.add(messy);
        raw.add(Map.of("name", ""));
        raw.add(null);
        assertThat(Rx.sanitize(raw)).containsExactly(new Rx.Item("Tab. Y", null, "1-0-1", "AFTER_FOOD", null, null));
        assertThat(Rx.sanitize(null)).isEmpty();
    }

    @Test
    void keepsValidFields() {
        var item = Rx.sanitize(List.of(Map.of("name", "Tab. X", "dose", "1 tab", "frequency", "0-0-1", "timing", "BEDTIME", "days", 5))).getFirst();
        assertThat(item).isEqualTo(new Rx.Item("Tab. X", "1 tab", "0-0-1", "BEDTIME", 5, null));
    }

    @Test
    void starterFavouritesAreValid() {
        assertThat(Rx.STARTER_MEDICINES).hasSize(10).allSatisfy(m -> assertThat(Rx.TIMINGS).contains(m.timing()));
    }
}
