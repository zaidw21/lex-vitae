package com.arcus.platform.audit;

import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.support.Json;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

@RestController
public class AuditController {

    private final JdbcClient db;

    public AuditController(JdbcClient db) {
        this.db = db;
    }

    public record Entry(String actorName, String action, String entity, String entityId, Map<String, Object> data, OffsetDateTime createdAt) {
    }

    @GetMapping("/api/audit")
    @Transactional(readOnly = true)
    public List<Entry> list() {
        AppRegistry.requireManager();
        return db.sql("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200")
                .query((rs, n) -> new Entry(rs.getString("actor_name"), rs.getString("action"), rs.getString("entity"),
                        rs.getString("entity_id"), Json.map(rs.getString("data")), Sql.time(rs, "created_at")))
                .list();
    }
}
