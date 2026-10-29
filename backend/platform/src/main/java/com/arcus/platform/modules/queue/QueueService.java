package com.arcus.platform.modules.queue;

import com.arcus.platform.contacts.Contact;
import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.ArcusProperties;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.messaging.NotificationService;
import com.arcus.platform.support.Ids;
import com.arcus.platform.support.Ist;
import com.arcus.platform.support.Json;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Today's queue: tokens, status changes, WhatsApp updates, wait estimates. */
@Service
public class QueueService {

    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "WAITING", Set.of("IN_PROGRESS", "SKIPPED", "CANCELLED"),
            "IN_PROGRESS", Set.of("DONE", "WAITING"),
            "SKIPPED", Set.of("WAITING", "CANCELLED"),
            "DONE", Set.of(),
            "CANCELLED", Set.of("WAITING"));

    private final JdbcClient db;
    private final ContactService contacts;
    private final NotificationService notifications;
    private final ArcusProperties props;

    public QueueService(JdbcClient db, ContactService contacts, NotificationService notifications, ArcusProperties props) {
        this.db = db;
        this.contacts = contacts;
        this.notifications = notifications;
        this.props = props;
    }

    private static UUID orgId() {
        return TenantContext.orgId().orElseThrow(UserError.Unauthorized::new);
    }

    public static boolean canTransition(String from, String to) {
        return TRANSITIONS.getOrDefault(from, Set.of()).contains(to);
    }

    public record Entry(UUID id, LocalDate date, int tokenNumber, UUID contactId, UUID providerId, UUID appointmentId, String status,
                        String publicCode, OffsetDateTime checkedInAt, OffsetDateTime startedAt, OffsetDateTime completedAt) {
    }

    static final RowMapper<Entry> ROW = (rs, n) -> new Entry(Sql.uuid(rs, "id"), Sql.date(rs, "date"), rs.getInt("token_number"),
            Sql.uuid(rs, "contact_id"), Sql.uuid(rs, "provider_id"), Sql.uuid(rs, "appointment_id"), rs.getString("status"),
            rs.getString("public_code"), Sql.time(rs, "checked_in_at"), Sql.time(rs, "started_at"), Sql.time(rs, "completed_at"));

    @Transactional(readOnly = true)
    public Entry get(UUID id) {
        return db.sql("SELECT * FROM queue_entries WHERE id = ?").param(id).query(ROW).optional().orElseThrow(() -> new UserError.NotFound("Queue entry"));
    }

    /** Issue today's next token (or return the contact's active one). Serialized per organization and day. */
    @Transactional
    public Entry issueToken(UUID contactId, UUID providerId, UUID appointmentId) {
        AppRegistry.requireModule(QueueModule.ID);
        Principal p = TenantContext.require();
        Contact contact = contacts.get(contactId);
        LocalDate date = Ist.today();
        db.sql("SELECT pg_advisory_xact_lock(hashtext(?))").param("queue:" + p.orgId() + ":" + date).query(Object.class).single();
        Optional<Entry> active = db.sql("SELECT * FROM queue_entries WHERE date = ? AND contact_id = ? AND status IN ('WAITING','IN_PROGRESS')")
                .params(date, contactId).query(ROW).optional();
        if (active.isPresent()) return active.get();
        int next = db.sql("SELECT coalesce(max(token_number), 0) + 1 FROM queue_entries WHERE date = ?").param(date).query(Integer.class).single();
        UUID id = db.sql("""
                        INSERT INTO queue_entries (org_id, date, token_number, contact_id, provider_id, appointment_id, public_code)
                        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                .params(p.orgId(), date, next, contactId, providerId, appointmentId, Ids.publicCode()).query(UUID.class).single();
        if (appointmentId != null) db.sql("UPDATE appointments SET status = 'CHECKED_IN' WHERE id = ?").param(appointmentId).update();
        Entry entry = get(id);
        notifications.notify(contact, "TOKEN_ISSUED", Map.of("token", entry.tokenNumber(), "ahead", peopleAhead(entry),
                "link", props.link("/t/" + entry.publicCode())));
        return entry;
    }

    long peopleAhead(Entry e) {
        return db.sql("""
                        SELECT count(*) FROM queue_entries WHERE date = :date AND status = 'WAITING' AND token_number < :token
                        AND (CAST(:provider AS uuid) IS NULL OR provider_id = :provider OR provider_id IS NULL)""")
                .param("date", e.date()).param("token", e.tokenNumber()).param("provider", e.providerId())
                .query(Long.class).single();
    }

    @Transactional
    public Entry setStatus(UUID entryId, String status) {
        AppRegistry.requireModule(QueueModule.ID);
        Principal p = TenantContext.require();
        Entry entry = get(entryId);
        if (!canTransition(entry.status(), status)) throw new UserError("Cannot move from " + entry.status() + " to " + status + ".");
        db.sql("""
                        UPDATE queue_entries SET status = :status,
                          started_at = CASE WHEN :status = 'IN_PROGRESS' THEN now() ELSE started_at END,
                          provider_id = CASE WHEN :status = 'IN_PROGRESS' THEN coalesce(provider_id, CAST(:me AS uuid)) ELSE provider_id END,
                          completed_at = CASE WHEN :status = 'DONE' THEN now() ELSE completed_at END
                        WHERE id = :id""")
                .param("status", status).param("me", p.membershipId()).param("id", entryId).update();
        if ("IN_PROGRESS".equals(status)) nudgeUpcoming(entry.date());
        if (entry.appointmentId() != null && ("DONE".equals(status) || "CANCELLED".equals(status))) {
            db.sql("UPDATE appointments SET status = ? WHERE id = ?").params("DONE".equals(status) ? "COMPLETED" : "CANCELLED", entry.appointmentId()).update();
        }
        return get(entryId);
    }

    /** Mark an entry done (e.g. when an app finishes its encounter for it). No-op if already done. */
    @Transactional
    public void complete(UUID entryId) {
        Entry entry = get(entryId);
        if ("DONE".equals(entry.status())) return;
        db.sql("UPDATE queue_entries SET status = 'DONE', completed_at = now(), started_at = coalesce(started_at, now()) WHERE id = ?").param(entryId).update();
        if (entry.appointmentId() != null) db.sql("UPDATE appointments SET status = 'COMPLETED' WHERE id = ?").param(entry.appointmentId()).update();
    }

    /** Start the next waiting token; empty when no one is waiting. */
    @Transactional
    public Optional<Entry> callNext() {
        AppRegistry.requireModule(QueueModule.ID);
        Optional<UUID> next = db.sql("SELECT id FROM queue_entries WHERE date = ? AND status = 'WAITING' ORDER BY token_number LIMIT 1")
                .param(Ist.today()).query(UUID.class).optional();
        return next.map(id -> setStatus(id, "IN_PROGRESS"));
    }

    /** Tell whoever is now second in line that their turn is near (once). */
    private void nudgeUpcoming(LocalDate date) {
        List<Entry> waiting = db.sql("SELECT * FROM queue_entries WHERE date = ? AND status = 'WAITING' ORDER BY token_number LIMIT 2")
                .param(date).query(ROW).list();
        if (waiting.size() < 2) return;
        Entry target = waiting.get(1);
        long already = db.sql("SELECT count(*) FROM messages WHERE contact_id = ? AND template = 'TURN_NEAR' AND created_at >= ?")
                .params(target.contactId(), target.checkedInAt()).query(Long.class).single();
        if (already == 0) notifications.notify(contacts.get(target.contactId()), "TURN_NEAR", Map.of("token", target.tokenNumber()));
    }

    @Transactional
    public int delayNotice(int minutes) {
        AppRegistry.requireModule(QueueModule.ID);
        if (minutes < 5 || minutes > 300) throw new UserError("Enter a delay between 5 and 300 minutes.");
        List<Entry> waiting = db.sql("SELECT * FROM queue_entries WHERE date = ? AND status = 'WAITING'").param(Ist.today()).query(ROW).list();
        for (Entry w : waiting) {
            notifications.notify(contacts.get(w.contactId()), "DELAY_NOTICE", Map.of("minutes", minutes, "link", props.link("/t/" + w.publicCode())));
        }
        return waiting.size();
    }

    /** Average minutes per person served on `date`, falling back to the configured estimate. */
    int averageMinutes(LocalDate date, int fallback) {
        List<long[]> done = db.sql("""
                        SELECT extract(epoch FROM started_at)::bigint AS s, extract(epoch FROM completed_at)::bigint AS c FROM queue_entries
                        WHERE date = ? AND status = 'DONE' AND started_at IS NOT NULL AND completed_at IS NOT NULL
                        ORDER BY completed_at DESC LIMIT 10""")
                .param(date).query((rs, n) -> new long[]{rs.getLong("s"), rs.getLong("c")}).list();
        if (done.size() < 3) return fallback;
        long total = done.stream().mapToLong(d -> d[1] - d[0]).sum();
        return (int) Math.max(2, Math.round(total / (double) done.size() / 60));
    }

    static int configuredMinutes(Map<String, Object> settings) {
        Object v = settings.getOrDefault("queueAvgMinutes", settings.get("avgConsultMinutes"));
        return v instanceof Number n ? n.intValue() : 8;
    }

    int configuredMinutes() {
        return configuredMinutes(Json.map(db.sql("SELECT settings FROM organizations WHERE id = ?").param(orgId()).query(String.class).single()));
    }

    public record BoardEntry(Entry entry, Contact contact, boolean hasEncounter) {
    }

    public record Board(LocalDate date, List<BoardEntry> entries, int avgMinutes) {
    }

    @Transactional(readOnly = true)
    public Board board() {
        AppRegistry.requireModule(QueueModule.ID);
        LocalDate date = Ist.today();
        List<Entry> entries = db.sql("SELECT * FROM queue_entries WHERE date = ? ORDER BY token_number").param(date).query(ROW).list();
        Set<UUID> withEncounter = Set.copyOf(db.sql("SELECT queue_entry_id FROM encounters WHERE queue_entry_id IS NOT NULL AND occurred_at >= ?")
                .param(Ist.startOf(date)).query(UUID.class).list());
        List<BoardEntry> rows = entries.stream().map(e -> new BoardEntry(e, contacts.get(e.contactId()), withEncounter.contains(e.id()))).toList();
        return new Board(date, rows, averageMinutes(date, configuredMinutes()));
    }

    public record Summary(Map<String, Long> byStatus, long[] checkInsByHour) {
    }

    /** Dashboard widget: today's counts by status and check-ins by IST hour over the last 30 days. */
    @Transactional(readOnly = true)
    public Summary summary() {
        AppRegistry.requireModule(QueueModule.ID);
        Map<String, Long> byStatus = new java.util.HashMap<>();
        db.sql("SELECT status, count(*) AS n FROM queue_entries WHERE date = ? GROUP BY status").param(Ist.today())
                .query((rs, n) -> byStatus.put(rs.getString("status"), rs.getLong("n"))).list();
        long[] hours = new long[24];
        db.sql("SELECT extract(hour FROM checked_in_at AT TIME ZONE 'Asia/Kolkata')::int AS h, count(*) AS n FROM queue_entries WHERE date >= ? GROUP BY 1")
                .param(Ist.today().minusDays(30)).query((rs, n) -> hours[rs.getInt("h")] = rs.getLong("n")).list();
        return new Summary(byStatus, hours);
    }

    public record TokenStatus(String orgName, int tokenNumber, String status, boolean isToday, long ahead, int avgMinutes,
                              Integer nowServing, String lang) {
    }

    /** Public status page for one token. Call within the owning organization's scope. */
    @Transactional(readOnly = true)
    public TokenStatus tokenStatus(String publicCode) {
        Entry e = db.sql("SELECT * FROM queue_entries WHERE public_code = ?").param(publicCode).query(ROW).optional()
                .orElseThrow(() -> new UserError.NotFound("Token"));
        String orgName = db.sql("SELECT name FROM organizations WHERE id = ?").param(orgId()).query(String.class).single();
        String lang = db.sql("SELECT preferred_lang FROM contacts WHERE id = ?").param(e.contactId()).query(String.class).single();
        Integer serving = db.sql("SELECT token_number FROM queue_entries WHERE date = ? AND status = 'IN_PROGRESS' ORDER BY started_at DESC LIMIT 1")
                .param(e.date()).query(Integer.class).optional().orElse(null);
        return new TokenStatus(orgName, e.tokenNumber(), e.status(), e.date().equals(Ist.today()), peopleAhead(e),
                averageMinutes(e.date(), configuredMinutes()), serving, lang);
    }

    public record Display(String orgName, List<Integer> serving, List<Integer> waiting) {
    }

    /** Waiting-room TV: token numbers only, never names. Call within the owning organization's scope. */
    @Transactional(readOnly = true)
    public Display display() {
        var org = db.sql("SELECT name, modules FROM organizations WHERE id = ?").param(orgId()).query((rs, n) -> new Object[]{rs.getString("name"), Sql.strings(rs, "modules")}).single();
        @SuppressWarnings("unchecked") List<String> modules = (List<String>) org[1];
        if (!modules.contains(QueueModule.ID)) throw new UserError.NotFound("Queue");
        List<Entry> active = db.sql("SELECT * FROM queue_entries WHERE date = ? AND status IN ('WAITING','IN_PROGRESS') ORDER BY token_number")
                .param(Ist.today()).query(ROW).list();
        return new Display((String) org[0],
                active.stream().filter(e -> "IN_PROGRESS".equals(e.status())).map(Entry::tokenNumber).toList(),
                active.stream().filter(e -> "WAITING".equals(e.status())).map(Entry::tokenNumber).limit(12).toList());
    }

}
