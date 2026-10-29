package com.arcus.platform.telemetry;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.classic.spi.ThrowableProxyUtil;
import org.springframework.boot.logging.structured.StructuredLogFormatter;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * One JSON object per line in the format Google Cloud Logging understands (`severity`, `message`, `time`).
 * Errors with a stack trace carry the Cloud Error Reporting type, so they are grouped and alerted on without
 * any extra service. Other collectors (Grafana, Datadog, ELK) ingest the same lines.
 */
public class GcpLogFormatter implements StructuredLogFormatter<ILoggingEvent> {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Override
    public String format(ILoggingEvent event) {
        Map<String, Object> line = new LinkedHashMap<>();
        line.put("severity", severity(event.getLevel()));
        line.put("time", Instant.ofEpochMilli(event.getTimeStamp()).toString());
        line.put("message", event.getFormattedMessage());
        if (!"arcus".equals(event.getLoggerName())) line.put("logger", event.getLoggerName());
        line.putAll(event.getMDCPropertyMap());
        if (event.getKeyValuePairs() != null) event.getKeyValuePairs().forEach(kv -> line.put(kv.key, kv.value));
        IThrowableProxy error = event.getThrowableProxy();
        if (error != null) {
            line.put("@type", "type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent");
            line.put("stack_trace", ThrowableProxyUtil.asString(error));
        }
        try {
            return JSON.writeValueAsString(line) + "\n";
        } catch (RuntimeException e) {
            return "{\"severity\":\"ERROR\",\"message\":\"log formatting failed\"}\n";
        }
    }

    private static String severity(Level level) {
        return switch (level.toInt()) {
            case Level.ERROR_INT -> "ERROR";
            case Level.WARN_INT -> "WARNING";
            case Level.INFO_INT -> "INFO";
            default -> "DEBUG";
        };
    }
}
