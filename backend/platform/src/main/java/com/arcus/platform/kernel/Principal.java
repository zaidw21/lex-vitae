package com.arcus.platform.kernel;

import java.util.List;
import java.util.UUID;

/** The signed-in user acting in one organization. */
public record Principal(
        UUID userId,
        String userName,
        UUID orgId,
        UUID membershipId,
        Role role,
        String app,
        List<String> modules) {

    public boolean hasModule(String module) {
        return modules.contains(module);
    }
}
