package com.arcus.platform.auth;

import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.ArcusProperties;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.Role;
import com.arcus.platform.kernel.Tx;
import com.arcus.platform.support.Ist;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Bearer-token sessions. Only the SHA-256 of a token is stored. */
@Service
public class SessionService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final JdbcClient db;
    private final Tx tx;
    private final AppRegistry registry;
    private final ArcusProperties props;

    public SessionService(JdbcClient db, Tx tx, AppRegistry registry, ArcusProperties props) {
        this.db = db;
        this.tx = tx;
        this.registry = registry;
        this.props = props;
    }

    static String hash(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Create a session and return its token (shown to the client once). */
    public String start(UUID userId, UUID orgId) {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        tx.system(() -> db.sql("INSERT INTO sessions (id, user_id, org_id, expires_at) VALUES (?, ?, ?, ?)")
                .params(hash(token), userId, orgId, Ist.now().plusDays(props.sessionDays()))
                .update());
        return token;
    }

    public void end(String token) {
        tx.system(() -> db.sql("DELETE FROM sessions WHERE id = ?").param(hash(token)).update());
    }

    /** Point a session at another organization the user belongs to. */
    public boolean switchOrg(String token, UUID orgId) {
        return tx.system(() -> {
            UUID userId = db.sql("SELECT user_id FROM sessions WHERE id = ? AND expires_at > now()").param(hash(token))
                    .query(UUID.class).optional().orElse(null);
            if (userId == null) return false;
            boolean member = db.sql("SELECT count(*) FROM memberships WHERE user_id = ? AND org_id = ? AND active")
                    .params(userId, orgId).query(Long.class).single() > 0;
            if (member) db.sql("UPDATE sessions SET org_id = ? WHERE id = ?").params(orgId, hash(token)).update();
            return member;
        });
    }

    private record Row(UUID userId, String userName, UUID orgId, UUID membershipId, String role, String app, List<String> modules) {
    }

    /** The principal for a token: the session's organization, else the user's first active membership. */
    public Optional<Principal> principalForToken(String token) {
        return tx.system(() -> {
            var session = db.sql("SELECT user_id, org_id FROM sessions WHERE id = ? AND expires_at > now()").param(hash(token))
                    .query((rs, n) -> new UUID[]{Sql.uuid(rs, "user_id"), Sql.uuid(rs, "org_id")}).optional();
            if (session.isEmpty()) return Optional.<Principal>empty();
            UUID userId = session.get()[0];
            UUID preferredOrg = session.get()[1];
            List<Row> rows = db.sql("""
                            SELECT u.id AS user_id, u.name AS user_name, m.org_id, m.id AS membership_id, m.role, o.app, o.modules
                            FROM memberships m JOIN users u ON u.id = m.user_id JOIN organizations o ON o.id = m.org_id
                            WHERE m.user_id = ? AND m.active ORDER BY m.created_at""")
                    .param(userId)
                    .query((rs, n) -> new Row(Sql.uuid(rs, "user_id"), rs.getString("user_name"), Sql.uuid(rs, "org_id"),
                            Sql.uuid(rs, "membership_id"), rs.getString("role"), rs.getString("app"), Sql.strings(rs, "modules")))
                    .list();
            Row row = rows.stream().filter(r -> r.orgId().equals(preferredOrg)).findFirst().orElse(rows.isEmpty() ? null : rows.getFirst());
            if (row == null) return Optional.<Principal>empty();
            var app = registry.find(row.app());
            if (app.isEmpty()) return Optional.<Principal>empty();
            return Optional.of(new Principal(row.userId(), row.userName(), row.orgId(), row.membershipId(), Role.valueOf(row.role()),
                    row.app(), registry.enabledModules(app.get(), row.modules())));
        });
    }
}
