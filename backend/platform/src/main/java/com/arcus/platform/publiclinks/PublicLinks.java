package com.arcus.platform.publiclinks;

import com.arcus.platform.kernel.Tx;
import com.arcus.platform.support.Json;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Public pages (a patient's token status, prescription or receipt) are reached by unguessable codes. The
 * code is resolved across organizations once; everything after that runs scoped to the owning organization.
 */
@Component
public class PublicLinks {

    private final JdbcClient db;
    private final Tx tx;

    public PublicLinks(JdbcClient db, Tx tx) {
        this.db = db;
        this.tx = tx;
    }

    /** What a public page may show about the practice. */
    public record PublicOrg(UUID id, String name, String slug, String app, String address, String phone, String gstin) {
    }

    /** The organization that owns the row with this public code in `table`, if any. */
    public Optional<UUID> ownerOf(String table, String code) {
        if (!table.matches("[a-z_]+")) throw new IllegalArgumentException(table);
        return tx.system(() -> db.sql("SELECT org_id FROM " + table + " WHERE public_code = ?").param(code).query(UUID.class).optional());
    }

    public Optional<UUID> orgBySlug(String slug) {
        return tx.system(() -> db.sql("SELECT id FROM organizations WHERE slug = ?").param(slug).query(UUID.class).optional());
    }

    public PublicOrg org(UUID orgId) {
        return tx.asOrg(orgId, () -> db.sql("SELECT id, name, slug, app, address, phone, settings FROM organizations WHERE id = ?").param(orgId)
                .query((rs, n) -> new PublicOrg(Sql.uuid(rs, "id"), rs.getString("name"), rs.getString("slug"), rs.getString("app"),
                        rs.getString("address"), rs.getString("phone"), (String) Json.map(rs.getString("settings")).get("gstin")))
                .single());
    }

    /** Run read work scoped to one organization (no signed-in user). */
    public <T> T asOrg(UUID orgId, java.util.function.Supplier<T> work) {
        return tx.asOrg(orgId, work);
    }

    public Map<String, Object> settings(UUID orgId) {
        return tx.asOrg(orgId, () -> Json.map(db.sql("SELECT settings FROM organizations WHERE id = ?").param(orgId).query(String.class).single()));
    }
}
