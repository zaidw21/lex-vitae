package com.arcus.platform.documents;

import com.arcus.platform.contacts.Contact;
import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.kernel.ArcusProperties;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.messaging.NotificationService;
import com.arcus.platform.support.Ids;
import com.arcus.platform.support.Json;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Printable documents (prescriptions, notices...). Apps define their own types and render them on the web. */
@Service
public class DocumentService {

    private final JdbcClient db;
    private final ContactService contacts;
    private final NotificationService notifications;
    private final ArcusProperties props;

    public DocumentService(JdbcClient db, ContactService contacts, NotificationService notifications, ArcusProperties props) {
        this.db = db;
        this.contacts = contacts;
        this.notifications = notifications;
        this.props = props;
    }

    public record Document(UUID id, UUID contactId, UUID encounterId, String refType, String refId, String type, String title,
                           Map<String, Object> data, String publicCode, OffsetDateTime createdAt) {
    }

    public static final RowMapper<Document> ROW = (rs, n) -> new Document(Sql.uuid(rs, "id"), Sql.uuid(rs, "contact_id"),
            Sql.uuid(rs, "encounter_id"), rs.getString("ref_type"), rs.getString("ref_id"), rs.getString("type"), rs.getString("title"),
            Json.map(rs.getString("data")), rs.getString("public_code"), Sql.time(rs, "created_at"));

    @Transactional
    public Document create(UUID contactId, UUID encounterId, String type, String title, Map<String, ?> data) {
        Principal p = TenantContext.require();
        UUID id = db.sql("""
                        INSERT INTO documents (org_id, contact_id, encounter_id, type, title, data, public_code, created_by)
                        VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?) RETURNING id""")
                .params(p.orgId(), contactId, encounterId, type, title, Json.write(data), Ids.publicCode(), p.userId())
                .query(UUID.class).single();
        return get(id);
    }

    @Transactional(readOnly = true)
    public Document get(UUID id) {
        return db.sql("SELECT * FROM documents WHERE id = ?").param(id).query(ROW).optional().orElseThrow(() -> new UserError.NotFound("Document"));
    }

    @Transactional(readOnly = true)
    public UUID byCode(String publicCode) {
        return db.sql("SELECT id FROM documents WHERE public_code = ?").param(publicCode).query(UUID.class).optional()
                .orElseThrow(() -> new UserError.NotFound("Document"));
    }

    @Transactional(readOnly = true)
    public List<Document> forEncounters(Collection<UUID> encounterIds) {
        if (encounterIds.isEmpty()) return List.of();
        return db.sql("SELECT * FROM documents WHERE encounter_id IN (:ids) ORDER BY created_at").param("ids", encounterIds).query(ROW).list();
    }

    @Transactional
    public void share(UUID id) {
        Document doc = get(id);
        Contact contact = contacts.get(doc.contactId());
        notifications.notify(contact, "DOCUMENT_SHARED", Map.of("link", props.link("/d/" + doc.publicCode())));
    }
}
