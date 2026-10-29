package com.arcus.platform.telemetry;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.spi.LoggingEventBuilder;

/**
 * The platform logger. Events are short names ("queue.token_issued") with key/value fields; the request,
 * organization, user and app are attached automatically (see {@link RequestTelemetryFilter}).
 * Apps use this instead of adding their own logging or error SDKs.
 */
public final class Log {

    private static final Logger LOG = LoggerFactory.getLogger("arcus");

    private Log() {
    }

    public static void info(String event, Object... keyValues) {
        build(LOG.atInfo(), keyValues).log(event);
    }

    public static void warn(String event, Object... keyValues) {
        build(LOG.atWarn(), keyValues).log(event);
    }

    /** Report an unexpected error (grouped and alerted on by the error reporting backend). */
    public static void error(String event, Throwable error, Object... keyValues) {
        build(LOG.atError(), keyValues).setCause(error).log(event);
    }

    private static LoggingEventBuilder build(LoggingEventBuilder builder, Object[] keyValues) {
        for (int i = 0; i + 1 < keyValues.length; i += 2) builder = builder.addKeyValue(String.valueOf(keyValues[i]), keyValues[i + 1]);
        return builder;
    }
}
