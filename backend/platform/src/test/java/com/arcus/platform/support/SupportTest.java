package com.arcus.platform.support;

import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class SupportTest {

    @Test
    void normalizesIndianMobilesAndRejectsJunk() {
        assertThat(Phones.normalize("98260 12345")).contains("+919826012345");
        assertThat(Phones.normalize("+91-98260-12345")).contains("+919826012345");
        assertThat(Phones.normalize("09826012345")).contains("+919826012345");
        assertThat(Phones.normalize("919826012345")).contains("+919826012345");
        assertThat(Phones.normalize("011 2345 678")).isEmpty();
        assertThat(Phones.normalize("12345")).isEmpty();
        assertThat(Phones.normalize(null)).isEmpty();
    }

    @Test
    void parsesAndFormatsMoneyInPaise() {
        assertThat(Money.rupeesToPaise("1,250.50")).isEqualTo(125050);
        assertThat(Money.rupeesToPaise("₹400")).isEqualTo(40000);
        assertThat(Money.rupeesToPaise("-5")).isZero();
        assertThat(Money.rupeesToPaise("abc")).isZero();
        assertThat(Money.format(12345600)).isEqualTo("₹1,23,456");
        assertThat(Money.format(12345)).isEqualTo("₹123.45");
        assertThat(Money.format(100000000)).isEqualTo("₹10,00,000");
    }

    @Test
    void istDayBoundariesAreInIndianTime() {
        LocalDate day = LocalDate.of(2026, 3, 11);
        assertThat(Ist.startOf(day).toString()).isEqualTo("2026-03-10T18:30Z");
        assertThat(Ist.endOf(day).toString()).isEqualTo("2026-03-11T18:30Z");
        assertThat(Ist.at(day, 10, 0).toString()).isEqualTo("2026-03-11T04:30Z");
        assertThat(Ist.dateOf(Ist.startOf(day).plusMinutes(30))).isEqualTo(day);
    }

    @Test
    void publicCodesAreUnambiguousAndSlugsClean() {
        assertThat(Ids.publicCode()).hasSize(10).matches("[23456789a-hjkmnp-z]+");
        assertThat(Ids.slugify("Sharma Family Clinic Indore")).isEqualTo("sharma-family-clinic-indore");
        assertThat(Ids.slugify("Verma & Associates")).isEqualTo("verma-associates");
    }

    @Test
    void nullSafeOneOf() {
        assertThat(Strings.oneOf(null, "A", "B")).isFalse();
        assertThat(Strings.oneOf("A", "A", "B")).isTrue();
    }
}
