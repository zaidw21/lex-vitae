package com.arcus.platform.insights;

import com.arcus.platform.support.Ist;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Numbers for the dashboard. All days are IST days. */
@Service
public class InsightsService {

    private final JdbcClient db;

    public InsightsService(JdbcClient db) {
        this.db = db;
    }

    public record Day(LocalDate date, long visits, long collected) {
    }

    public record Mix(long total, long newCount, long returning) {
    }

    public record Dashboard(List<Day> days, Mix mix, long collectedToday, long outstanding, long followUpsDue, long failedMessagesToday) {
    }

    @Transactional(readOnly = true)
    public Dashboard dashboard() {
        LocalDate today = Ist.today();
        LocalDate first = today.minusDays(13);
        Map<LocalDate, Long> visits = new HashMap<>();
        db.sql("SELECT (occurred_at AT TIME ZONE 'Asia/Kolkata')::date AS d, count(*) AS n FROM encounters WHERE occurred_at >= ? GROUP BY 1")
                .param(Ist.startOf(first)).query((rs, n) -> visits.put(rs.getObject("d", LocalDate.class), rs.getLong("n"))).list();
        Map<LocalDate, Long> money = new HashMap<>();
        db.sql("SELECT (received_at AT TIME ZONE 'Asia/Kolkata')::date AS d, sum(amount) AS n FROM payments WHERE received_at >= ? GROUP BY 1")
                .param(Ist.startOf(first)).query((rs, n) -> money.put(rs.getObject("d", LocalDate.class), rs.getLong("n"))).list();
        List<Day> days = new ArrayList<>();
        for (LocalDate d = first; !d.isAfter(today); d = d.plusDays(1)) days.add(new Day(d, visits.getOrDefault(d, 0L), money.getOrDefault(d, 0L)));

        // Of the people seen in the last 30 days: first-ever visit vs. seen more than once.
        var mix = db.sql("""
                        SELECT count(*) AS total, count(*) FILTER (WHERE visits > 1) AS returning FROM (
                          SELECT e.contact_id, (SELECT count(*) FROM encounters x WHERE x.contact_id = e.contact_id) AS visits
                          FROM encounters e WHERE e.occurred_at >= ? GROUP BY e.contact_id) s""")
                .param(Ist.startOf(today.minusDays(29)))
                .query((rs, n) -> new Mix(rs.getLong("total"), rs.getLong("total") - rs.getLong("returning"), rs.getLong("returning"))).single();
        long collectedToday = db.sql("SELECT coalesce(sum(amount), 0) FROM payments WHERE received_at >= ? AND received_at < ?")
                .params(Ist.startOf(today), Ist.endOf(today)).query(Long.class).single();
        long outstanding = db.sql("SELECT coalesce(sum(total - paid), 0) FROM invoices WHERE status IN ('UNPAID','PARTIAL')").query(Long.class).single();
        long followUps = db.sql("SELECT count(*) FROM tasks WHERE status = 'OPEN' AND due_on <= ?").param(today).query(Long.class).single();
        long failed = db.sql("SELECT count(*) FROM messages WHERE status = 'FAILED' AND created_at >= ?").param(Ist.startOf(today)).query(Long.class).single();
        return new Dashboard(days, mix, collectedToday, outstanding, followUps, failed);
    }
}
