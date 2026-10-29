package com.arcus.apps.legal;

import com.arcus.platform.audit.AuditService;
import com.arcus.platform.contacts.Contact;
import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.encounters.EncounterService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.messaging.NotificationService;
import com.arcus.platform.support.Ist;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class MatterService {

    /** Platform records (encounters, invoices, tasks) point at a matter with this ref type. */
    public static final String REF = "matter";
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final JdbcClient db;
    private final ContactService contacts;
    private final EncounterService encounters;
    private final NotificationService notifications;
    private final AuditService audit;

    public MatterService(JdbcClient db, ContactService contacts, EncounterService encounters, NotificationService notifications, AuditService audit) {
        this.db = db;
        this.contacts = contacts;
        this.encounters = encounters;
        this.notifications = notifications;
        this.audit = audit;
    }

    public record Matter(UUID id, UUID contactId, String clientName, String clientPhone, String title, String caseNumber, String cnr,
                         String court, String caseType, String oppositeParty, String stage, String status, LocalDate nextHearingOn,
                         OffsetDateTime createdAt) {
    }

    private static final RowMapper<Matter> ROW = (rs, n) -> new Matter(Sql.uuid(rs, "id"), Sql.uuid(rs, "contact_id"),
            rs.getString("client_name"), rs.getString("client_phone"), rs.getString("title"), rs.getString("case_number"),
            rs.getString("cnr"), rs.getString("court"), rs.getString("case_type"), rs.getString("opposite_party"), rs.getString("stage"),
            rs.getString("status"), Sql.date(rs, "next_hearing_on"), Sql.time(rs, "created_at"));

    private static final String SELECT = "SELECT m.*, c.name AS client_name, c.phone AS client_phone FROM legal_matters m JOIN contacts c ON c.id = m.contact_id ";

    @Transactional(readOnly = true)
    public Matter get(UUID id) {
        AppRegistry.requireApp(LegalApp.ID);
        return db.sql(SELECT + "WHERE m.id = ?").param(id).query(ROW).optional().orElseThrow(() -> new UserError.NotFound("Matter"));
    }

    @Transactional(readOnly = true)
    public List<Matter> search(String q, String status) {
        AppRegistry.requireApp(LegalApp.ID);
        String term = q == null ? "" : q.trim();
        return db.sql(SELECT + """
                        WHERE m.status = :status AND (:q = '' OR m.title ILIKE '%' || :q || '%' OR m.case_number ILIKE '%' || :q || '%'
                          OR m.cnr ILIKE '%' || :q || '%' OR c.name ILIKE '%' || :q || '%')
                        ORDER BY m.next_hearing_on ASC NULLS FIRST LIMIT 200""")
                .param("status", "CLOSED".equals(status) ? "CLOSED" : "OPEN").param("q", term).query(ROW).list();
    }

    @Transactional(readOnly = true)
    public List<Matter> forClient(UUID contactId) {
        AppRegistry.requireApp(LegalApp.ID);
        return db.sql(SELECT + "WHERE m.contact_id = ? ORDER BY m.created_at DESC").param(contactId).query(ROW).list();
    }

    public record NewMatter(UUID contactId, String title, String caseNumber, String cnr, String court, String caseType, String oppositeParty,
                            String stage, LocalDate nextHearingOn) {
    }

    @Transactional
    public UUID create(NewMatter in) {
        Principal p = AppRegistry.requireApp(LegalApp.ID);
        Contact client = contacts.get(in.contactId());
        if (in.title() == null || in.title().isBlank()) throw new UserError("Give the matter a title, e.g. “Sharma vs. State”.");
        return db.sql("""
                        INSERT INTO legal_matters (org_id, contact_id, title, case_number, cnr, court, case_type, opposite_party, stage, next_hearing_on)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                .params(p.orgId(), client.id(), clip(in.title(), 200), blank(in.caseNumber()),
                        blank(in.cnr()) == null ? null : in.cnr().trim().toUpperCase(Locale.ROOT), blank(in.court()), blank(in.caseType()),
                        blank(in.oppositeParty()), blank(in.stage()), in.nextHearingOn())
                .query(UUID.class).single();
    }

    @Transactional
    public void setStatus(UUID id, String status) {
        AppRegistry.requireApp(LegalApp.ID);
        db.sql("UPDATE legal_matters SET status = ? WHERE id = ?").params("CLOSED".equals(status) ? "CLOSED" : "OPEN", id).update();
    }

    public record Hearing(LocalDate heldOn, String purpose, String outcome, LocalDate nextDate, String stage, boolean notifyClient) {
    }

    /** Record what happened at a hearing, move the matter to its next date and tell the client. */
    @Transactional
    public void recordHearing(UUID matterId, Hearing in) {
        Matter matter = get(matterId);
        if (in.heldOn() == null) throw new UserError("Pick the hearing date.");
        if (in.outcome() == null || in.outcome().isBlank()) throw new UserError("Please note what happened at the hearing.");
        if (in.nextDate() != null && !in.nextDate().isAfter(in.heldOn())) throw new UserError("The next date must be after the hearing date.");
        String stage = blank(in.stage()) == null ? matter.stage() : in.stage().trim();

        Map<String, Object> data = new LinkedHashMap<>();
        data.put("purpose", in.purpose());
        data.put("outcome", in.outcome().trim());
        data.put("stage", stage);
        data.put("nextDate", in.nextDate() == null ? null : in.nextDate().toString());
        encounters.create(new EncounterService.NewEncounter(matter.contactId(), null, REF, matter.id().toString(), "HEARING",
                Ist.startOf(in.heldOn()), clip(in.outcome(), 500), data, in.nextDate()));
        db.sql("UPDATE legal_matters SET next_hearing_on = ?, stage = ?, status = CASE WHEN ? = 'Disposed' THEN 'CLOSED' ELSE status END WHERE id = ?")
                .params(in.nextDate(), stage, stage, matter.id()).update();
        audit.record("hearing.recorded", "Matter", matter.id(), Map.of("heldOn", in.heldOn().toString()));
        if (in.notifyClient()) {
            notifications.notify(contacts.get(matter.contactId()), "HEARING_UPDATE", Map.of(
                    "matter", matter.caseNumber() == null ? matter.title() : matter.title() + " (" + matter.caseNumber() + ")",
                    "outcome", in.outcome().trim(),
                    "next", in.nextDate() == null ? "to be notified" : in.nextDate().format(DATE)));
        }
    }

    public record Diary(LocalDate date, List<Matter> listed, List<Matter> needsDate, Map<LocalDate, Long> week) {
    }

    /** The advocate's board for a day, matters whose date has lapsed, and counts for the coming week. */
    @Transactional(readOnly = true)
    public Diary diary(LocalDate day) {
        AppRegistry.requireApp(LegalApp.ID);
        LocalDate today = Ist.today();
        List<Matter> listed = db.sql(SELECT + "WHERE m.status = 'OPEN' AND m.next_hearing_on = ? ORDER BY m.court").param(day).query(ROW).list();
        List<Matter> stale = db.sql(SELECT + "WHERE m.status = 'OPEN' AND (m.next_hearing_on IS NULL OR m.next_hearing_on < ?) ORDER BY m.next_hearing_on")
                .param(today).query(ROW).list();
        Map<LocalDate, Long> week = new LinkedHashMap<>();
        for (int i = 0; i < 7; i++) week.put(today.plusDays(i), 0L);
        db.sql("SELECT next_hearing_on, count(*) AS n FROM legal_matters WHERE status = 'OPEN' AND next_hearing_on >= ? AND next_hearing_on < ? GROUP BY 1")
                .params(today, today.plusDays(7))
                .query((rs, n) -> week.put(Sql.date(rs, "next_hearing_on"), rs.getLong("n"))).list();
        return new Diary(day, listed, stale, week);
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String clip(String s, int max) {
        String t = s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }
}
