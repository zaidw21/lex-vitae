package com.arcus.platform.kernel;

public enum Role {
    OWNER, ADMIN, PRACTITIONER, STAFF;

    public boolean canManage() {
        return this == OWNER || this == ADMIN;
    }
}
