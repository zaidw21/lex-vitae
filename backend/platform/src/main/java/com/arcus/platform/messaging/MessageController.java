package com.arcus.platform.messaging;

import com.arcus.platform.support.Ist;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
public class MessageController {

    private final NotificationService notifications;
    private final JdbcClient db;

    public MessageController(NotificationService notifications, JdbcClient db) {
        this.notifications = notifications;
        this.db = db;
    }

    public record Outbox(List<NotificationService.Message> messages, long sentToday, long failed, String provider) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Outbox list(@RequestParam(defaultValue = "false") boolean failed) {
        long sentToday = db.sql("SELECT count(*) FROM messages WHERE status = 'SENT' AND created_at >= ?").param(Ist.startOf(Ist.today()))
                .query(Long.class).single();
        long failedCount = db.sql("SELECT count(*) FROM messages WHERE status = 'FAILED'").query(Long.class).single();
        return new Outbox(notifications.list(failed, null, 100), sentToday, failedCount, notifications.provider());
    }

    @PostMapping("/{id}/retry")
    public Map<String, Boolean> retry(@PathVariable UUID id) {
        notifications.retry(id);
        return Map.of("ok", true);
    }
}
