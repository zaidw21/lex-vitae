package com.arcus.platform.kernel.web;

/**
 * An error whose message is safe to show to the user (HTTP 400). Anything else becomes a generic message
 * and is reported as an error.
 */
public class UserError extends RuntimeException {

    public UserError(String message) {
        super(message);
    }

    /** 404: the record doesn't exist or belongs to another organization. */
    public static class NotFound extends UserError {
        public NotFound(String what) {
            super(what + " not found.");
        }
    }

    /** 403: signed in, but not allowed (role or module). */
    public static class Forbidden extends UserError {
        public Forbidden(String message) {
            super(message);
        }
    }

    /** 401: not signed in. */
    public static class Unauthorized extends UserError {
        public Unauthorized() {
            super("Please log in.");
        }
    }
}
