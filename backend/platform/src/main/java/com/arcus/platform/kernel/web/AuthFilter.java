package com.arcus.platform.kernel.web;

import com.arcus.platform.auth.SessionService;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
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
import java.util.List;
import java.util.Optional;

/**
 * Resolves the bearer token to a {@link Principal} and sets the {@link TenantContext} for the request.
 * Every /api route requires it except the public ones listed here.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class AuthFilter extends OncePerRequestFilter {

    private static final List<String> PUBLIC = List.of("/api/auth/login", "/api/auth/signup", "/api/apps", "/api/public/");

    private final SessionService sessions;

    public AuthFilter(SessionService sessions) {
        this.sessions = sessions;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String path = request.getRequestURI();
        try {
            Optional<Principal> principal = bearer(request).flatMap(sessions::principalForToken);
            principal.ifPresent(p -> {
                TenantContext.set(p);
                MDC.put("orgId", p.orgId().toString());
                MDC.put("userId", p.userId().toString());
                MDC.put("app", p.app());
            });
            boolean isPublic = !path.startsWith("/api/") || PUBLIC.stream().anyMatch(path::startsWith);
            if (principal.isEmpty() && !isPublic) {
                response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"Please log in.\"}");
                return;
            }
            chain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    static Optional<String> bearer(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith("Bearer ")) return Optional.empty();
        String token = header.substring(7).trim();
        return token.isEmpty() ? Optional.empty() : Optional.of(token);
    }
}
