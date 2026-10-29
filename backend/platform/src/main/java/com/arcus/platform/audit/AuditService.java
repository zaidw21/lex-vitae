package com.arcus.platform.audit;

import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.support.Json;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

import java.util.Map;

/** Who did what. Billing changes (discounts, voids, payments) always go through here. Rows are never edited. */
@Service
public class AuditService {

    private final JdbcClient db;

    public AuditService(JdbcClient db) {
        this.db = db;
    }

    /** Record an action by the signed-in user. Call inside the transaction that performs the action. */
    public void record(String action, String entity, Object entityId, Map<String, ?> data) {
        Principal p = TenantContext.require();
        db.sql("""
                        INSERT INTO audit_logs (org_id, actor_id, actor_name, action, entity, entity_id, data)
                        VALUES (?, ?, ?, ?, ?, ?, ?::jsonb)""")
                .params(p.orgId(), p.userId(), p.userName(), action, entity, entityId == null ? null : entityId.toString(), Json.write(data))
                .update();
    }
}
