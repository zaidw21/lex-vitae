package com.arcus.platform.kernel;

import com.arcus.platform.kernel.web.UserError;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Who the current request acts for. Set by the authentication filter for every API request, read by
 * {@link TenantTransactionManager} to scope every database transaction to the organization.
 *
 * <p>Code that legitimately works across organizations (sign-in, public links) must say so explicitly with
 * {@link #asSystem(Supplier)}; everything else only ever sees its own organization's rows.
 */
public final class TenantContext {

    private static final ThreadLocal<Principal> PRINCIPAL = new ThreadLocal<>();
    private static final ThreadLocal<UUID> ORG = new ThreadLocal<>();
    private static final ThreadLocal<Boolean> SYSTEM = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void set(Principal principal) {
        PRINCIPAL.set(principal);
        ORG.set(principal == null ? null : principal.orgId());
    }

    public static void clear() {
        PRINCIPAL.remove();
        ORG.remove();
        SYSTEM.remove();
    }

    public static Optional<Principal> current() {
        return Optional.ofNullable(PRINCIPAL.get());
    }

    /** The signed-in principal; fails with 401 when there is none. */
    public static Principal require() {
        Principal p = PRINCIPAL.get();
        if (p == null) throw new UserError.Unauthorized();
        return p;
    }

    /** The organization database transactions are scoped to (may be set without a principal, e.g. public pages). */
    public static Optional<UUID> orgId() {
        return Optional.ofNullable(ORG.get());
    }

    public static boolean isSystem() {
        return Boolean.TRUE.equals(SYSTEM.get());
    }

    /** Run with row-level security bypassed. Only for platform code that must span organizations. */
    public static <T> T asSystem(Supplier<T> work) {
        Boolean previous = SYSTEM.get();
        SYSTEM.set(true);
        try {
            return work.get();
        } finally {
            SYSTEM.set(previous);
        }
    }

    /** Run scoped to one organization without a signed-in user (public links, background jobs). */
    public static <T> T asOrg(UUID orgId, Supplier<T> work) {
        UUID previousOrg = ORG.get();
        Boolean previousSystem = SYSTEM.get();
        ORG.set(orgId);
        SYSTEM.set(false);
        try {
            return work.get();
        } finally {
            ORG.set(previousOrg);
            SYSTEM.set(previousSystem);
        }
    }
}
