package com.arcus.platform.auth;

import com.arcus.platform.kernel.web.UserError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService auth;
    private final SessionService sessions;

    public AuthController(AuthService auth, SessionService sessions) {
        this.auth = auth;
        this.sessions = sessions;
    }

    public record Token(String token) {
    }

    @PostMapping("/signup")
    public Token signup(@RequestBody AuthService.Signup body) {
        return new Token(auth.signup(body));
    }

    public record Login(String email, String password) {
    }

    @PostMapping("/login")
    public Token login(@RequestBody Login body) {
        return new Token(auth.login(body.email(), body.password()));
    }

    @PostMapping("/logout")
    public Map<String, Boolean> logout(HttpServletRequest request) {
        token(request).ifPresent(sessions::end);
        return Map.of("ok", true);
    }

    public record SwitchOrg(UUID orgId) {
    }

    @PostMapping("/switch-org")
    public Map<String, Boolean> switchOrg(HttpServletRequest request, @RequestBody SwitchOrg body) {
        String token = token(request).orElseThrow(UserError.Unauthorized::new);
        if (!sessions.switchOrg(token, body.orgId())) throw new UserError.Forbidden("You are not a member of that practice.");
        return Map.of("ok", true);
    }

    private static java.util.Optional<String> token(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        return header != null && header.startsWith("Bearer ") ? java.util.Optional.of(header.substring(7).trim()) : java.util.Optional.empty();
    }
}
