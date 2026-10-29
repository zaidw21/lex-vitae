package com.arcus.platform.modules.appointments;

import com.arcus.platform.contacts.Contact;
import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.messaging.NotificationService;
import com.arcus.platform.modules.queue.QueueModule;
import com.arcus.platform.modules.queue.QueueService;
import com.arcus.platform.support.Ist;
import com.arcus.platform.support.Strings;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
public class AppointmentService {

    private static final DateTimeFormatter WHEN = DateTimeFormatter.ofPattern("d MMM, h:mm a", Locale.ENGLISH);

    private final JdbcClient db;
    private final ContactService contacts;
    private final NotificationService notifications;
    private final QueueService queue;

    public AppointmentService(JdbcClient db, ContactService contacts, NotificationService notifications, QueueService queue) {
        this.db = db;
        this.contacts = contacts;
        this.notifications = notifications;
        this.queue = queue;
    }

    public record Appointment(UUID id, UUID contactId, String contactName, String contactPhone, UUID providerId, String providerName,
                              OffsetDateTime startsAt, int durationMin, String status, String source, String notes) {
    }

    private static final RowMapper<Appointment> ROW = (rs, n) -> new Appointment(Sql.uuid(rs, "id"), Sql.uuid(rs, "contact_id"),
            rs.getString("contact_name"), rs.getString("contact_phone"), Sql.uuid(rs, "provider_id"), rs.getString("provider_name"),
            Sql.time(rs, "starts_at"), rs.getInt("duration_min"), rs.getString("status"), rs.getString("source"), rs.getString("notes"));

    private static final String SELECT = """
            SELECT a.*, c.name AS contact_name, c.phone AS contact_phone, u.name AS provider_name FROM appointments a
            JOIN contacts c ON c.id = a.contact_id LEFT JOIN memberships m ON m.id = a.provider_id LEFT JOIN users u ON u.id = m.user_id
            """;

    @Transactional(readOnly = true)
    public List<Appointment> forDay(LocalDate day) {
        AppRegistry.requireModule(AppointmentsModule.ID);
        return db.sql(SELECT + "WHERE a.starts_at >= ? AND a.starts_at < ? ORDER BY a.starts_at")
                .params(Ist.startOf(day), Ist.endOf(day)).query(ROW).list();
    }

    public record NewAppointment(UUID contactId, LocalDate date, String time, UUID providerId, int durationMin, String source, String notes) {
    }

    @Transactional
    public UUID book(NewAppointment in) {
        AppRegistry.requireModule(AppointmentsModule.ID);
        Principal p = TenantContext.require();
        Contact contact = contacts.get(in.contactId());
        if (in.date() == null || in.time() == null || !in.time().matches("\\d{2}:\\d{2}")) throw new UserError("Please pick a date and time.");
        OffsetDateTime startsAt = Ist.at(in.date(), Integer.parseInt(in.time().substring(0, 2)), Integer.parseInt(in.time().substring(3)));
        if (in.providerId() != null && db.sql("SELECT count(*) FROM memberships WHERE id = ?").param(in.providerId()).query(Long.class).single() == 0) {
            throw new UserError("Unknown practitioner.");
        }
        UUID id = db.sql("""
                        INSERT INTO appointments (org_id, contact_id, provider_id, starts_at, duration_min, source, notes)
                        VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                .params(p.orgId(), contact.id(), in.providerId(), startsAt, Math.min(Math.max(in.durationMin(), 5), 240),
                        in.source() == null || in.source().isBlank() ? "PHONE" : in.source(), blank(in.notes()))
                .query(UUID.class).single();
        String address = db.sql("SELECT coalesce(address, city, '') FROM organizations WHERE id = ?").param(p.orgId()).query(String.class).single();
        notifications.notify(contact, "APPOINTMENT_BOOKED", Map.of("when", startsAt.atZoneSameInstant(Ist.ZONE).format(WHEN), "address", address));
        return id;
    }

    /** CHECKED_IN issues a queue token (queue module required); other statuses just update the appointment. */
    @Transactional
    public void setStatus(UUID id, String status) {
        AppRegistry.requireModule(AppointmentsModule.ID);
        Appointment a = db.sql(SELECT + "WHERE a.id = ?").param(id).query(ROW).optional().orElseThrow(() -> new UserError.NotFound("Appointment"));
        if ("CHECKED_IN".equals(status)) {
            AppRegistry.requireModule(QueueModule.ID);
            queue.issueToken(a.contactId(), a.providerId(), a.id());
            return;
        }
        if (!Strings.oneOf(status, "COMPLETED", "CANCELLED", "NO_SHOW", "BOOKED")) throw new UserError("Invalid status.");
        db.sql("UPDATE appointments SET status = ? WHERE id = ?").params(status, id).update();
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
