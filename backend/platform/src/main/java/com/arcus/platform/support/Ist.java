package com.arcus.platform.support;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

/** All practices are in India: "today" and day boundaries are always in IST. */
public final class Ist {

    public static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private static Clock clock = Clock.systemUTC();

    private Ist() {
    }

    public static LocalDate today() {
        return LocalDate.now(clock.withZone(ZONE));
    }

    public static LocalDate dateOf(OffsetDateTime at) {
        return at.atZoneSameInstant(ZONE).toLocalDate();
    }

    /** Start (inclusive) of an IST calendar day, as an instant. */
    public static OffsetDateTime startOf(LocalDate day) {
        return day.atStartOfDay(ZONE).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC);
    }

    /** End (exclusive) of an IST calendar day. */
    public static OffsetDateTime endOf(LocalDate day) {
        return startOf(day.plusDays(1));
    }

    /** An IST date + "HH:mm" time entered by a user, as an instant. */
    public static OffsetDateTime at(LocalDate day, int hour, int minute) {
        return day.atTime(hour, minute).atZone(ZONE).toOffsetDateTime().withOffsetSameInstant(ZoneOffset.UTC);
    }

    public static OffsetDateTime now() {
        return OffsetDateTime.ofInstant(Instant.now(clock), ZoneOffset.UTC);
    }

    /** For tests. */
    public static void useClock(Clock testClock) {
        clock = testClock;
    }
}
