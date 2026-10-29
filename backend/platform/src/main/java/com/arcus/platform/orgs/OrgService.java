package com.arcus.platform.orgs;

import com.arcus.platform.audit.AuditService;
import com.arcus.platform.auth.AuthService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.Tx;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.support.Json;
import com.arcus.platform.support.Strings;
import com.arcus.platform.support.Phones;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/** The current organization: profile, settings, modules, team and catalog. */
@Service
public class OrgService {

    private final JdbcClient db;
    private final Tx tx;
    private final AuditService audit;
    private final AppRegistry registry;

    public OrgService(JdbcClient db, Tx tx, AuditService audit, AppRegistry registry) {
        this.db = db;
        this.tx = tx;
        this.audit = audit;
        this.registry = registry;
    }

    public record Org(UUID id, String name, String slug, String app, List<String> modules, String city, String phone, String email,
                      String address, Map<String, Object> settings, OffsetDateTime createdAt) {
    }

    @Transactional(readOnly = true)
    public Org current() {
        return db.sql("SELECT * FROM organizations WHERE id = ?").param(TenantContext.require().orgId())
                .query((rs, n) -> new Org(Sql.uuid(rs, "id"), rs.getString("name"), rs.getString("slug"), rs.getString("app"),
                        Sql.strings(rs, "modules"), rs.getString("city"), rs.getString("phone"), rs.getString("email"),
                        rs.getString("address"), Json.map(rs.getString("settings")), Sql.time(rs, "created_at")))
                .single();
    }

    @Transactional(readOnly = true)
    public Map<String, Object> settings() {
        return current().settings();
    }

    public record Profile(String name, String phone, String city, String address, String email, String gstin) {
    }

    @Transactional
    public void updateProfile(Profile in) {
        Principal p = AppRegistry.requireManager();
        if (in.name() == null || in.name().isBlank()) throw new UserError("Practice name is required.");
        String phone = null;
        if (in.phone() != null && !in.phone().isBlank()) phone = Phones.normalize(in.phone()).orElseThrow(() -> new UserError("Please enter a valid mobile number."));
        Map<String, Object> settings = new HashMap<>(settings());
        settings.put("gstin", blankToNull(in.gstin()));
        db.sql("UPDATE organizations SET name = ?, phone = ?, city = ?, address = ?, email = ?, settings = ?::jsonb WHERE id = ?")
                .params(in.name().trim(), phone, blankToNull(in.city()), blankToNull(in.address()), blankToNull(in.email()), Json.write(settings), p.orgId())
                .update();
        audit.record("settings.updated", "Organization", p.orgId(), Map.of());
    }

    /** Merge values into the organization's settings. For apps' and modules' own settings screens. */
    @Transactional
    public void mergeSettings(Map<String, Object> values) {
        Principal p = AppRegistry.requireManager();
        Map<String, Object> settings = new HashMap<>(settings());
        settings.putAll(values);
        db.sql("UPDATE organizations SET settings = ?::jsonb WHERE id = ?").params(Json.write(settings), p.orgId()).update();
        audit.record("settings.updated", "Organization", p.orgId(), Map.of("keys", values.keySet()));
    }

    @Transactional
    public List<String> setModules(List<String> requested) {
        Principal p = AppRegistry.requireManager();
        List<String> allowed = registry.allowedModules(registry.app(p.app()));
        List<String> modules = allowed.stream().filter(requested::contains).toList();
        db.sql("UPDATE organizations SET modules = ? WHERE id = ?").params(modules.toArray(String[]::new), p.orgId()).update();
        audit.record("settings.modules", "Organization", p.orgId(), Map.of("modules", modules));
        return modules;
    }

    public record MyProfile(String name, String qualifications, String registrationNo) {
    }

    public void updateMyProfile(MyProfile in) {
        Principal p = TenantContext.require();
        if (in.name() == null || in.name().isBlank()) throw new UserError("Name is required.");
        tx.run(() -> db.sql("UPDATE memberships SET qualifications = ?, registration_no = ? WHERE id = ?")
                .params(blankToNull(in.qualifications()), blankToNull(in.registrationNo()), p.membershipId()).update());
        // users are global (not tenant-owned): a user may only rename themselves
        tx.system(() -> db.sql("UPDATE users SET name = ? WHERE id = ?").params(in.name().trim(), p.userId()).update());
    }

    public record Member(UUID id, UUID userId, String name, String email, String role, String qualifications, String registrationNo) {
    }

    @Transactional(readOnly = true)
    public List<Member> team() {
        // users are not tenant-scoped; the join only reaches users who are members of this organization
        return db.sql("""
                        SELECT m.id, m.user_id, u.name, u.email, m.role, m.qualifications, m.registration_no
                        FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.active ORDER BY m.created_at""")
                .query((rs, n) -> new Member(Sql.uuid(rs, "id"), Sql.uuid(rs, "user_id"), rs.getString("name"), rs.getString("email"),
                        rs.getString("role"), rs.getString("qualifications"), rs.getString("registration_no")))
                .list();
    }

    @Transactional(readOnly = true)
    public Member me() {
        UUID membershipId = TenantContext.require().membershipId();
        return team().stream().filter(m -> m.id().equals(membershipId)).findFirst().orElseThrow();
    }

    public record NewMember(String name, String email, String role, String password) {
    }

    public void addMember(NewMember in) {
        Principal p = AppRegistry.requireManager();
        String email = in.email() == null ? "" : in.email().trim().toLowerCase(Locale.ROOT);
        if (!email.contains("@") || in.name() == null || in.name().isBlank()) throw new UserError("Name and email are required.");
        if (!Strings.oneOf(in.role(), "ADMIN", "PRACTITIONER", "STAFF")) throw new UserError("Choose a role.");
        UUID userId = tx.system(() -> db.sql("SELECT id FROM users WHERE email = ?").param(email).query(UUID.class).optional().orElseGet(() -> {
            if (in.password() == null || in.password().length() < 8) throw new UserError("Set a temporary password of at least 8 characters.");
            return db.sql("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?) RETURNING id")
                    .params(email, in.name().trim(), AuthService.hashPassword(in.password())).query(UUID.class).single();
        }));
        tx.run(() -> {
            db.sql("""
                            INSERT INTO memberships (org_id, user_id, role) VALUES (?, ?, ?)
                            ON CONFLICT (org_id, user_id) DO UPDATE SET role = excluded.role, active = true""")
                    .params(p.orgId(), userId, in.role()).update();
            audit.record("member.added", "Membership", null, Map.of("email", email, "role", in.role()));
            return null;
        });
    }

    public void removeMember(UUID membershipId) {
        Principal p = AppRegistry.requireManager();
        tx.run(() -> {
            var m = db.sql("SELECT user_id, role FROM memberships WHERE id = ?").param(membershipId)
                    .query((rs, n) -> new Object[]{Sql.uuid(rs, "user_id"), rs.getString("role")}).optional()
                    .orElseThrow(() -> new UserError.NotFound("Team member"));
            if ("OWNER".equals(m[1])) throw new UserError("The owner cannot be removed.");
            db.sql("UPDATE memberships SET active = false WHERE id = ?").param(membershipId).update();
            audit.record("member.removed", "Membership", membershipId, Map.of());
            return null;
        });
        tx.system(() -> db.sql("DELETE FROM sessions WHERE org_id = ? AND user_id = (SELECT user_id FROM memberships WHERE id = ?)")
                .params(p.orgId(), membershipId).update());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
