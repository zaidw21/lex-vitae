package com.arcus.platform.auth;

import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.Tx;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.orgs.ProvisioningService;
import com.arcus.platform.support.Phones;
import com.arcus.platform.telemetry.Log;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Locale;
import java.util.UUID;

@Service
public class AuthService {

    private static final BCryptPasswordEncoder PASSWORDS = new BCryptPasswordEncoder(10);

    private final JdbcClient db;
    private final Tx tx;
    private final SessionService sessions;
    private final AppRegistry registry;
    private final ProvisioningService provisioning;

    public AuthService(JdbcClient db, Tx tx, SessionService sessions, AppRegistry registry, ProvisioningService provisioning) {
        this.db = db;
        this.tx = tx;
        this.sessions = sessions;
        this.registry = registry;
        this.provisioning = provisioning;
    }

    public static String hashPassword(String password) {
        return PASSWORDS.encode(password);
    }

    public record Signup(String name, String email, String phone, String password, String orgName, String city, String app) {
    }

    /** Create a user and their first organization; returns a session token. */
    public String signup(Signup in) {
        String name = trim(in.name());
        String email = trim(in.email()).toLowerCase(Locale.ROOT);
        if (name.length() < 2) throw new UserError("Please enter your name.");
        if (!email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) throw new UserError("Please enter a valid email.");
        if (in.password() == null || in.password().length() < 8) throw new UserError("Password must be at least 8 characters.");
        if (trim(in.orgName()).length() < 2) throw new UserError("Please enter your practice name.");
        var app = registry.find(trim(in.app())).orElseThrow(() -> new UserError("Choose what kind of practice this is."));
        String phone = null;
        if (!trim(in.phone()).isEmpty()) phone = Phones.normalize(in.phone()).orElseThrow(() -> new UserError("Please enter a valid 10-digit mobile number."));
        final String normalizedPhone = phone;

        UUID userId = tx.system(() -> {
            if (db.sql("SELECT count(*) FROM users WHERE email = ?").param(email).query(Long.class).single() > 0) {
                throw new UserError("An account with this email already exists. Please log in.");
            }
            return db.sql("INSERT INTO users (email, name, phone, password_hash) VALUES (?, ?, ?, ?) RETURNING id")
                    .params(email, name, normalizedPhone, hashPassword(in.password())).query(UUID.class).single();
        });
        UUID orgId = provisioning.provision(new ProvisioningService.NewOrg(trim(in.orgName()), emptyToNull(in.city()), normalizedPhone, app, userId));
        Log.info("auth.signup", "app", app.id());
        return sessions.start(userId, orgId);
    }

    /** Returns a session token, or fails with a generic message (never reveals whether the email exists). */
    public String login(String emailInput, String password) {
        String email = trim(emailInput).toLowerCase(Locale.ROOT);
        var user = tx.system(() -> db.sql("SELECT id, password_hash FROM users WHERE email = ?").param(email)
                .query((rs, n) -> new Object[]{rs.getObject("id", UUID.class), rs.getString("password_hash")}).optional());
        if (user.isEmpty() || password == null || !PASSWORDS.matches(password, (String) user.get()[1])) {
            throw new UserError("Incorrect email or password.");
        }
        return sessions.start((UUID) user.get()[0], null);
    }

    private static String trim(String s) {
        return s == null ? "" : s.trim();
    }

    private static String emptyToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
