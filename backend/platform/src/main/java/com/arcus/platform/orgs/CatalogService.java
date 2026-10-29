package com.arcus.platform.orgs;

import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.support.Json;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Billable services ("SERVICE") and app-defined catalog kinds (e.g. favourite medicines). */
@Service
public class CatalogService {

    private final JdbcClient db;

    public CatalogService(JdbcClient db) {
        this.db = db;
    }

    public record Item(UUID id, String kind, String name, long price, Map<String, Object> data) {
    }

    @Transactional(readOnly = true)
    public List<Item> list(String kind) {
        return db.sql("SELECT id, kind, name, price, data FROM catalog_items WHERE kind = ? AND active ORDER BY name").param(kind)
                .query((rs, n) -> new Item(Sql.uuid(rs, "id"), rs.getString("kind"), rs.getString("name"), rs.getLong("price"),
                        Json.map(rs.getString("data"))))
                .list();
    }

    @Transactional
    public Item add(String kind, String name, long price, Map<String, Object> data) {
        Principal p = AppRegistry.requireManager();
        if (name == null || name.isBlank()) throw new UserError("Name is required.");
        String trimmed = name.trim().length() > 120 ? name.trim().substring(0, 120) : name.trim();
        UUID id = db.sql("INSERT INTO catalog_items (org_id, kind, name, price, data) VALUES (?, ?, ?, ?, ?::jsonb) RETURNING id")
                .params(p.orgId(), kind, trimmed, Math.max(0, price), Json.write(data)).query(UUID.class).single();
        return new Item(id, kind, trimmed, Math.max(0, price), data == null ? Map.of() : data);
    }

    @Transactional
    public void remove(UUID id) {
        AppRegistry.requireManager();
        db.sql("UPDATE catalog_items SET active = false WHERE id = ?").param(id).update();
    }
}
