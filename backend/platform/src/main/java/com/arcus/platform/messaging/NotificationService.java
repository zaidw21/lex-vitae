package com.arcus.platform.messaging;

import com.arcus.platform.channels.MessageChannel;
import com.arcus.platform.contacts.Contact;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.spi.Template;
import com.arcus.platform.support.Sql;
import com.arcus.platform.telemetry.Log;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Templated WhatsApp messages in the contact's language. Never throws for delivery problems: failures are
 * recorded on the message so staff can see and retry them.
 */
@Service
public class NotificationService {

    private final JdbcClient db;
    private final MessageChannel whatsapp;
    private final AppRegistry registry;

    public NotificationService(JdbcClient db, MessageChannel whatsapp, AppRegistry registry) {
        this.db = db;
        this.whatsapp = whatsapp;
        this.registry = registry;
    }

    /** The wording for a key: the app's, else an enabled module's, else the platform default. */
    Optional<Template> template(String app, List<String> modules, String key) {
        Template t = registry.app(app).messages().get(key);
        if (t != null) return Optional.of(t);
        for (String m : modules) {
            t = registry.module(m).messages().get(key);
            if (t != null) return Optional.of(t);
        }
        return Optional.ofNullable(PlatformTemplates.MESSAGES.get(key));
    }

    /** Send a templated message to a contact of the current organization. */
    @Transactional
    public void notify(Contact contact, String key, Map<String, ?> vars) {
        Principal p = TenantContext.require();
        notify(p.orgId(), p.app(), p.modules(), contact, key, vars);
    }

    /** As above, for callers without a signed-in user (jobs). */
    @Transactional
    public void notify(UUID orgId, String app, List<String> modules, Contact contact, String key, Map<String, ?> vars) {
        Optional<Template> template = template(app, modules, key);
        if (template.isEmpty()) {
            Log.warn("message.template_missing", "key", key);
            return;
        }
        String orgName = db.sql("SELECT name FROM organizations WHERE id = ?").param(orgId).query(String.class).single();
        Map<String, Object> all = new HashMap<>(vars);
        all.putIfAbsent("name", contact.name());
        all.putIfAbsent("org", orgName);
        deliver(orgId, contact.id(), contact.phone(), contact.whatsappOptIn(), key, PlatformTemplates.render(template.get().in(contact.preferredLang()), all));
    }

    /** Record a message in the outbox and hand it to the configured provider. */
    @Transactional
    public void deliver(UUID orgId, UUID contactId, String phone, boolean optedIn, String template, String body) {
        UUID id = db.sql("""
                        INSERT INTO messages (org_id, contact_id, channel, to_phone, template, body, provider)
                        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                .params(orgId, contactId, whatsapp.channel(), phone, template, body, whatsapp.provider()).query(UUID.class).single();
        if (!optedIn) {
            db.sql("UPDATE messages SET status = 'FAILED', error = 'Not opted in to WhatsApp' WHERE id = ?").param(id).update();
            return;
        }
        MessageChannel.SendResult result = whatsapp.send(phone, body);
        if (result.ok()) {
            db.sql("UPDATE messages SET status = 'SENT', provider_ref = ? WHERE id = ?").params(result.ref(), id).update();
        } else {
            Log.warn("message.failed", "template", template, "provider", whatsapp.provider(), "error", result.error());
            db.sql("UPDATE messages SET status = 'FAILED', error = ? WHERE id = ?").params(result.error(), id).update();
        }
    }

    public record Message(UUID id, UUID contactId, String contactName, boolean contactOptedIn, String to, String template, String body,
                          String status, String provider, String error, OffsetDateTime createdAt) {
    }

    @Transactional(readOnly = true)
    public List<Message> list(boolean onlyFailed, UUID contactId, int limit) {
        return db.sql("""
                        SELECT m.*, c.name AS contact_name, c.whatsapp_opt_in FROM messages m LEFT JOIN contacts c ON c.id = m.contact_id
                        WHERE (:failed = false OR m.status = 'FAILED') AND (CAST(:contact AS uuid) IS NULL OR m.contact_id = :contact)
                        ORDER BY m.created_at DESC LIMIT :limit""")
                .param("failed", onlyFailed).param("contact", contactId).param("limit", limit)
                .query((rs, n) -> new Message(Sql.uuid(rs, "id"), Sql.uuid(rs, "contact_id"), rs.getString("contact_name"),
                        rs.getBoolean("whatsapp_opt_in"), rs.getString("to_phone"), rs.getString("template"), rs.getString("body"),
                        rs.getString("status"), rs.getString("provider"), rs.getString("error"), Sql.time(rs, "created_at")))
                .list();
    }

    /** Send a failed message again as a new outbox entry, keeping the failed one for the record. */
    @Transactional
    public void retry(UUID messageId) {
        Principal p = TenantContext.require();
        var row = db.sql("""
                        SELECT m.template, m.body, c.id AS contact_id, c.phone, c.whatsapp_opt_in FROM messages m
                        JOIN contacts c ON c.id = m.contact_id WHERE m.id = ? AND m.status = 'FAILED'""")
                .param(messageId)
                .query((rs, n) -> new Object[]{rs.getString("template"), rs.getString("body"), Sql.uuid(rs, "contact_id"),
                        rs.getString("phone"), rs.getBoolean("whatsapp_opt_in")})
                .optional();
        row.ifPresent(r -> deliver(p.orgId(), (UUID) r[2], (String) r[3], (Boolean) r[4], (String) r[0], (String) r[1]));
    }

    public String provider() {
        return whatsapp.provider();
    }
}
