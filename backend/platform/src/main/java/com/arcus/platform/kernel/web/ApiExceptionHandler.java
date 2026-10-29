package com.arcus.platform.kernel.web;

import com.arcus.platform.telemetry.Log;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

/** Every API error is {"error": "..."}; unexpected errors are reported and shown generically. */
@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(UserError.class)
    public ResponseEntity<Map<String, String>> userError(UserError e) {
        HttpStatus status = switch (e) {
            case UserError.NotFound ignored -> HttpStatus.NOT_FOUND;
            case UserError.Forbidden ignored -> HttpStatus.FORBIDDEN;
            case UserError.Unauthorized ignored -> HttpStatus.UNAUTHORIZED;
            default -> HttpStatus.BAD_REQUEST;
        };
        return ResponseEntity.status(status).body(Map.of("error", e.getMessage()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    public ResponseEntity<Map<String, String>> badRequest(Exception e) {
        String message = e instanceof MethodArgumentNotValidException m && m.getFieldError() != null
                ? m.getFieldError().getDefaultMessage()
                : "The request was not understood.";
        Log.info("http.bad_request", "reason", String.valueOf(NestedExceptionUtils.getMostSpecificCause(e).getMessage()));
        return ResponseEntity.badRequest().body(Map.of("error", message));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, String>> noRoute(NoResourceFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Not found."));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> unexpected(Exception e) {
        Log.error("http.unhandled", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Something went wrong. Please try again."));
    }
}
