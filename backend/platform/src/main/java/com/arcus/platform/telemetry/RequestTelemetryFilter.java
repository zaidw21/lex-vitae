package com.arcus.platform.telemetry;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Gives every request an id (honouring an incoming X-Request-Id), puts it in the logging context and logs
 * one line per API request with its status and duration. Org/user/app are added by the auth filter.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestTelemetryFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String requestId = request.getHeader("X-Request-Id");
        if (requestId == null || requestId.isBlank() || requestId.length() > 100) requestId = UUID.randomUUID().toString();
        long started = System.nanoTime();
        MDC.put("requestId", requestId);
        response.setHeader("X-Request-Id", requestId);
        try {
            chain.doFilter(request, response);
        } finally {
            if (request.getRequestURI().startsWith("/api/")) {
                Log.info("http.request",
                        "method", request.getMethod(),
                        "path", request.getRequestURI(),
                        "status", response.getStatus(),
                        "durationMs", (System.nanoTime() - started) / 1_000_000);
            }
            MDC.clear();
        }
    }
}
