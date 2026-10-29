package com.arcus.platform.tasks;

import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.messaging.NotificationService;
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

/** Follow-ups and to-dos, with WhatsApp reminders to the contact. */
@Service
public class TaskService {

    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH);

    private final JdbcClient db;
    private final ContactService contacts;
    private final NotificationService notifications;

    public TaskService(JdbcClient db, ContactService contacts, NotificationService notifications) {
        this.db = db;
        this.contacts = contacts;
        this.notifications = notifications;
    }

    public record Task(UUID id, UUID contactId, String contactName, String contactPhone, String refType, String refId, String kind,
                       String title, LocalDate dueOn, String status, OffsetDateTime remindedAt) {
    }

    private static final RowMapper<Task> ROW = (rs, n) -> new Task(Sql.uuid(rs, "id"), Sql.uuid(rs, "contact_id"), rs.getString("contact_name"),
            rs.getString("contact_phone"), rs.getString("ref_type"), rs.getString("ref_id"), rs.getString("kind"), rs.getString("title"),
            Sql.date(rs, "due_on"), rs.getString("status"), Sql.time(rs, "reminded_at"));

    private static final String SELECT = "SELECT t.*, c.name AS contact_name, c.phone AS contact_phone FROM tasks t LEFT JOIN contacts c ON c.id = t.contact_id ";

    public record NewTask(String title, LocalDate dueOn, UUID contactId, String kind, String refType, String refId) {
    }

    @Transactional
    public UUID create(NewTask in) {
        Principal p = TenantContext.require();
        if (in.title() == null || in.title().isBlank() || in.dueOn() == null) throw new UserError("Add a title and a due date.");
        if (in.contactId() != null) contacts.get(in.contactId());
        boolean hasRef = in.refType() != null && !in.refType().isBlank() && in.refId() != null && !in.refId().isBlank();
        String title = in.title().trim().length() > 200 ? in.title().trim().substring(0, 200) : in.title().trim();
        return db.sql("INSERT INTO tasks (org_id, contact_id, kind, title, due_on, ref_type, ref_id) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id")
                .params(p.orgId(), in.contactId(), in.kind() == null ? "GENERAL" : in.kind(), title, in.dueOn(),
                        hasRef ? in.refType() : null, hasRef ? in.refId() : null)
                .query(UUID.class).single();
    }

    /** Open tasks that are overdue or due within `days`. */
    @Transactional(readOnly = true)
    public List<Task> upcoming(int days) {
        return db.sql(SELECT + "WHERE t.status = 'OPEN' AND t.due_on <= ? ORDER BY t.due_on LIMIT 200")
                .param(Ist.today().plusDays(days)).query(ROW).list();
    }

    @Transactional(readOnly = true)
    public List<Task> forContact(UUID contactId) {
        return db.sql(SELECT + "WHERE t.contact_id = ? ORDER BY t.due_on DESC LIMIT 10").param(contactId).query(ROW).list();
    }

    @Transactional(readOnly = true)
    public List<Task> forRef(String refType, String refId) {
        return db.sql(SELECT + "WHERE t.ref_type = ? AND t.ref_id = ? ORDER BY t.due_on").params(refType, refId).query(ROW).list();
    }

    @Transactional
    public void setStatus(UUID id, String status) {
        if (!Strings.oneOf(status, "OPEN", "DONE", "CANCELLED")) throw new UserError("Invalid status.");
        db.sql("UPDATE tasks SET status = ? WHERE id = ?").params(status, id).update();
    }

    @Transactional
    public boolean remind(UUID id) {
        Task task = db.sql(SELECT + "WHERE t.id = ?").param(id).query(ROW).optional().orElseThrow(() -> new UserError.NotFound("Task"));
        if (task.contactId() == null || !"OPEN".equals(task.status())) return false;
        notifications.notify(contacts.get(task.contactId()), "FOLLOW_UP_REMINDER", Map.of("date", task.dueOn().format(DATE), "title", task.title()));
        db.sql("UPDATE tasks SET reminded_at = now() WHERE id = ?").param(id).update();
        return true;
    }

    /** Remind everyone whose follow-up is due tomorrow and has not been reminded yet. */
    @Transactional
    public int remindTomorrow() {
        List<UUID> ids = db.sql("SELECT id FROM tasks WHERE status = 'OPEN' AND due_on = ? AND reminded_at IS NULL AND contact_id IS NOT NULL")
                .param(Ist.today().plusDays(1)).query(UUID.class).list();
        int sent = 0;
        for (UUID id : ids) if (remind(id)) sent++;
        return sent;
    }
}
