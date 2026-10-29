package com.arcus.platform.encounters;

import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
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
import java.util.UUID;

/** One interaction with a contact: a consultation, a hearing, a class... Apps store their detail in `data`. */
@Service
public class EncounterService {

    private final JdbcClient db;

    public EncounterService(JdbcClient db) {
        this.db = db;
    }

    public record Encounter(UUID id, UUID contactId, UUID providerId, UUID queueEntryId, String refType, String refId, String kind,
                            OffsetDateTime occurredAt, String summary, Map<String, Object> data, LocalDate followUpOn) {
    }

    static final RowMapper<Encounter> ROW = (rs, n) -> new Encounter(Sql.uuid(rs, "id"), Sql.uuid(rs, "contact_id"),
            Sql.uuid(rs, "provider_id"), Sql.uuid(rs, "queue_entry_id"), rs.getString("ref_type"), rs.getString("ref_id"),
            rs.getString("kind"), Sql.time(rs, "occurred_at"), rs.getString("summary"), Json.map(rs.getString("data")),
            Sql.date(rs, "follow_up_on"));

    public record NewEncounter(UUID contactId, UUID queueEntryId, String refType, String refId, String kind, OffsetDateTime occurredAt,
                               String summary, Map<String, ?> data, LocalDate followUpOn) {
    }

    /** Record an encounter by the signed-in practitioner. */
    @Transactional
    public UUID create(NewEncounter in) {
        Principal p = TenantContext.require();
        return db.sql("""
                        INSERT INTO encounters (org_id, contact_id, provider_id, queue_entry_id, ref_type, ref_id, kind, occurred_at, summary, data, follow_up_on)
                        VALUES (?, ?, ?, ?, ?, ?, ?, coalesce(?, now()), ?, ?::jsonb, ?) RETURNING id""")
                .params(p.orgId(), in.contactId(), p.membershipId(), in.queueEntryId(), in.refType(), in.refId(), in.kind(),
                        in.occurredAt(), in.summary(), Json.write(in.data()), in.followUpOn())
                .query(UUID.class).single();
    }

    @Transactional(readOnly = true)
    public List<Encounter> forContact(UUID contactId, String kind, int limit) {
        return db.sql("""
                        SELECT * FROM encounters WHERE contact_id = :c AND (CAST(:k AS text) IS NULL OR kind = :k)
                        ORDER BY occurred_at DESC LIMIT :limit""")
                .param("c", contactId).param("k", kind).param("limit", limit).query(ROW).list();
    }

    @Transactional(readOnly = true)
    public List<Encounter> forRef(String refType, String refId) {
        return db.sql("SELECT * FROM encounters WHERE ref_type = ? AND ref_id = ? ORDER BY occurred_at DESC").params(refType, refId).query(ROW).list();
    }

    @Transactional(readOnly = true)
    public java.util.Optional<Encounter> forQueueEntry(UUID queueEntryId) {
        return db.sql("SELECT * FROM encounters WHERE queue_entry_id = ?").param(queueEntryId).query(ROW).optional();
    }
}
