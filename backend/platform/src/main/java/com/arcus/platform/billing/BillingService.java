package com.arcus.platform.billing;

import com.arcus.platform.audit.AuditService;
import com.arcus.platform.contacts.Contact;
import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.ArcusProperties;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.messaging.NotificationService;
import com.arcus.platform.support.Ids;
import com.arcus.platform.support.Strings;
import com.arcus.platform.support.Ist;
import com.arcus.platform.support.Money;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Bills, payments and the day book. Money is in paise. Every discount, payment and void is audited;
 * invoices and payments are never deleted.
 */
@Service
public class BillingService {

    public static final List<String> PAYMENT_MODES = List.of("CASH", "UPI", "CARD", "BANK", "OTHER");

    private final JdbcClient db;
    private final AuditService audit;
    private final ContactService contacts;
    private final NotificationService notifications;
    private final ArcusProperties props;

    public BillingService(JdbcClient db, AuditService audit, ContactService contacts, NotificationService notifications, ArcusProperties props) {
        this.db = db;
        this.audit = audit;
        this.contacts = contacts;
        this.notifications = notifications;
        this.props = props;
    }

    public record Line(String description, int qty, long unitPrice) {
    }

    public record Totals(long subtotal, long discount, long total) {
    }

    public static Totals totals(List<Line> lines, long discount) {
        long subtotal = lines.stream().mapToLong(l -> (long) Math.max(0, l.qty()) * Math.max(0, l.unitPrice())).sum();
        long d = Math.min(Math.max(0, discount), subtotal);
        return new Totals(subtotal, d, subtotal - d);
    }

    public static String statusFor(long total, long paid) {
        if (paid <= 0) return total == 0 ? "PAID" : "UNPAID";
        return paid >= total ? "PAID" : "PARTIAL";
    }

    public record Payment(long amount, String mode, String reference) {
    }

    public record NewInvoice(UUID contactId, UUID encounterId, String refType, String refId, List<Line> lines, long discount,
                             String notes, Payment payment, boolean sendReceipt) {
    }

    public record Invoice(UUID id, int number, UUID contactId, String contactName, UUID encounterId, String refType, String refId,
                          String status, long subtotal, long discount, long total, long paid, String notes, String voidReason,
                          String publicCode, OffsetDateTime createdAt) {
    }

    static final RowMapper<Invoice> ROW = (rs, n) -> new Invoice(Sql.uuid(rs, "id"), rs.getInt("number"), Sql.uuid(rs, "contact_id"),
            rs.getString("contact_name"), Sql.uuid(rs, "encounter_id"), rs.getString("ref_type"), rs.getString("ref_id"),
            rs.getString("status"), rs.getLong("subtotal"), rs.getLong("discount"), rs.getLong("total"), rs.getLong("paid"),
            rs.getString("notes"), rs.getString("void_reason"), rs.getString("public_code"), Sql.time(rs, "created_at"));

    private static final String SELECT = "SELECT i.*, c.name AS contact_name FROM invoices i JOIN contacts c ON c.id = i.contact_id ";

    /** Next number of a per-organization sequence (invoice numbers). Inside the caller's transaction. */
    private int nextNumber(UUID orgId, String key) {
        return db.sql("""
                        INSERT INTO counters (org_id, key, value) VALUES (?, ?, 1)
                        ON CONFLICT (org_id, key) DO UPDATE SET value = counters.value + 1 RETURNING value""")
                .params(orgId, key).query(Integer.class).single();
    }

    @Transactional
    public Invoice create(NewInvoice in) {
        Principal p = TenantContext.require();
        List<Line> lines = in.lines() == null ? List.of() : in.lines().stream()
                .filter(l -> l.description() != null && !l.description().isBlank() && l.qty() > 0)
                .map(l -> new Line(l.description().trim().length() > 200 ? l.description().trim().substring(0, 200) : l.description().trim(),
                        Math.min(l.qty(), 1000), Math.max(0, l.unitPrice())))
                .toList();
        if (lines.isEmpty()) throw new UserError("Add at least one item.");
        if (in.discount() > 0 && (in.notes() == null || in.notes().isBlank())) throw new UserError("Please note the reason for the discount.");
        Contact contact = contacts.get(in.contactId());
        Totals t = totals(lines, in.discount());
        long paid = in.payment() == null ? 0 : Math.min(Math.max(0, in.payment().amount()), t.total());
        if (in.payment() != null && !Strings.oneOf(in.payment().mode(), PAYMENT_MODES)) throw new UserError("Choose a payment mode.");
        int number = nextNumber(p.orgId(), "invoice");
        UUID id = db.sql("""
                        INSERT INTO invoices (org_id, number, contact_id, encounter_id, ref_type, ref_id, status, subtotal, discount, total, paid, notes, public_code, created_by)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""")
                .params(p.orgId(), number, contact.id(), in.encounterId(), in.refType(), in.refId(), statusFor(t.total(), paid),
                        t.subtotal(), t.discount(), t.total(), paid, blank(in.notes()), Ids.publicCode(), p.userId())
                .query(UUID.class).single();
        for (Line l : lines) {
            db.sql("INSERT INTO invoice_items (org_id, invoice_id, description, qty, unit_price, amount) VALUES (?, ?, ?, ?, ?, ?)")
                    .params(p.orgId(), id, l.description(), l.qty(), l.unitPrice(), (long) l.qty() * l.unitPrice()).update();
        }
        if (paid > 0) insertPayment(p, id, paid, in.payment().mode(), in.payment().reference());
        audit.record(t.discount() > 0 ? "invoice.created_with_discount" : "invoice.created", "Invoice", id,
                Map.of("number", number, "total", t.total(), "discount", t.discount(), "paid", paid));
        Invoice invoice = get(id);
        if (paid > 0 && in.sendReceipt()) sendReceipt(invoice, paid);
        return invoice;
    }

    private void insertPayment(Principal p, UUID invoiceId, long amount, String mode, String reference) {
        db.sql("INSERT INTO payments (org_id, invoice_id, amount, mode, reference, received_by) VALUES (?, ?, ?, ?, ?, ?)")
                .params(p.orgId(), invoiceId, amount, mode, blank(reference), p.userId()).update();
    }

    @Transactional
    public long recordPayment(UUID invoiceId, Payment payment, boolean sendReceipt) {
        Principal p = TenantContext.require();
        if (!Strings.oneOf(payment.mode(), PAYMENT_MODES)) throw new UserError("Choose a payment mode.");
        Invoice invoice = db.sql(SELECT + "WHERE i.id = ? FOR UPDATE OF i").param(invoiceId).query(ROW).optional()
                .orElseThrow(() -> new UserError.NotFound("Invoice"));
        if ("VOID".equals(invoice.status())) throw new UserError("This invoice is void.");
        long amount = Math.min(Math.max(0, payment.amount()), invoice.total() - invoice.paid());
        if (amount <= 0) throw new UserError("Nothing is due on this invoice.");
        insertPayment(p, invoiceId, amount, payment.mode(), payment.reference());
        long paid = invoice.paid() + amount;
        db.sql("UPDATE invoices SET paid = ?, status = ? WHERE id = ?").params(paid, statusFor(invoice.total(), paid), invoiceId).update();
        audit.record("payment.recorded", "Invoice", invoiceId, Map.of("amount", amount, "mode", payment.mode()));
        if (sendReceipt) sendReceipt(get(invoiceId), amount);
        return amount;
    }

    @Transactional
    public Invoice voidInvoice(UUID invoiceId, String reason) {
        AppRegistry.requireManager();
        if (reason == null || reason.isBlank()) throw new UserError("A reason is required to void an invoice.");
        Invoice invoice = get(invoiceId);
        if (!"VOID".equals(invoice.status())) {
            db.sql("UPDATE invoices SET status = 'VOID', void_reason = ? WHERE id = ?").params(reason.trim(), invoiceId).update();
            audit.record("invoice.voided", "Invoice", invoiceId,
                    Map.of("number", invoice.number(), "total", invoice.total(), "paid", invoice.paid(), "reason", reason.trim()));
        }
        return get(invoiceId);
    }

    private void sendReceipt(Invoice invoice, long amount) {
        notifications.notify(contacts.get(invoice.contactId()), "RECEIPT",
                Map.of("amount", Money.format(amount), "link", props.link("/r/" + invoice.publicCode())));
    }

    @Transactional(readOnly = true)
    public Invoice get(UUID id) {
        return db.sql(SELECT + "WHERE i.id = ?").param(id).query(ROW).optional().orElseThrow(() -> new UserError.NotFound("Invoice"));
    }

    /** @param filter all | due | paid | void */
    @Transactional(readOnly = true)
    public List<Invoice> list(String filter, UUID contactId, String refType, String refId, int limit) {
        String status = switch (filter == null ? "all" : filter) {
            case "due" -> "i.status IN ('UNPAID','PARTIAL')";
            case "paid" -> "i.status = 'PAID'";
            case "void" -> "i.status = 'VOID'";
            default -> "true";
        };
        return db.sql(SELECT + "WHERE " + status + """
                         AND (CAST(:contact AS uuid) IS NULL OR i.contact_id = :contact)
                         AND (CAST(:refType AS text) IS NULL OR (i.ref_type = :refType AND i.ref_id = :refId))
                        ORDER BY i.created_at DESC LIMIT :limit""")
                .param("contact", contactId).param("refType", refType).param("refId", refId).param("limit", limit)
                .query(ROW).list();
    }

    public record Item(String description, int qty, long unitPrice, long amount) {
    }

    public record PaymentRow(UUID id, UUID invoiceId, long amount, String mode, String reference, UUID receivedBy, String receivedByName,
                             OffsetDateTime receivedAt) {
    }

    public record AuditRow(String action, String actorName, Map<String, Object> data, OffsetDateTime createdAt) {
    }

    public record InvoiceDetail(Invoice invoice, Contact contact, List<Item> items, List<PaymentRow> payments, List<AuditRow> history) {
    }

    @Transactional(readOnly = true)
    public InvoiceDetail detail(UUID id) {
        Invoice invoice = get(id);
        return new InvoiceDetail(invoice, contacts.get(invoice.contactId()), items(id), payments(id),
                db.sql("SELECT action, actor_name, data, created_at FROM audit_logs WHERE entity = 'Invoice' AND entity_id = ? ORDER BY created_at")
                        .param(id.toString())
                        .query((rs, n) -> new AuditRow(rs.getString("action"), rs.getString("actor_name"),
                                com.arcus.platform.support.Json.map(rs.getString("data")), Sql.time(rs, "created_at")))
                        .list());
    }

    /** Receipt detail for a public link (no audit history). */
    @Transactional(readOnly = true)
    public InvoiceDetail detailByCode(String publicCode) {
        Invoice invoice = db.sql(SELECT + "WHERE i.public_code = ?").param(publicCode).query(ROW).optional()
                .orElseThrow(() -> new UserError.NotFound("Receipt"));
        return new InvoiceDetail(invoice, contacts.get(invoice.contactId()), items(invoice.id()), payments(invoice.id()), List.of());
    }

    List<Item> items(UUID invoiceId) {
        return db.sql("SELECT description, qty, unit_price, amount FROM invoice_items WHERE invoice_id = ? ORDER BY ctid").param(invoiceId)
                .query((rs, n) -> new Item(rs.getString("description"), rs.getInt("qty"), rs.getLong("unit_price"), rs.getLong("amount"))).list();
    }

    private static final String PAYMENTS = """
            SELECT p.*, u.name AS received_by_name FROM payments p LEFT JOIN users u ON u.id = p.received_by
            """;

    private static final RowMapper<PaymentRow> PAYMENT_ROW = (rs, n) -> new PaymentRow(Sql.uuid(rs, "id"), Sql.uuid(rs, "invoice_id"),
            rs.getLong("amount"), rs.getString("mode"), rs.getString("reference"), Sql.uuid(rs, "received_by"), rs.getString("received_by_name"),
            Sql.time(rs, "received_at"));

    List<PaymentRow> payments(UUID invoiceId) {
        return db.sql(PAYMENTS + "WHERE p.invoice_id = ? ORDER BY p.received_at").param(invoiceId).query(PAYMENT_ROW).list();
    }

    public record Summary(Map<String, Long> todayByMode, long collectedToday, long outstanding) {
    }

    @Transactional(readOnly = true)
    public Summary summary() {
        LocalDate today = Ist.today();
        Map<String, Long> byMode = new LinkedHashMap<>();
        PAYMENT_MODES.forEach(m -> byMode.put(m, 0L));
        db.sql("SELECT mode, sum(amount) AS total FROM payments WHERE received_at >= ? AND received_at < ? GROUP BY mode")
                .params(Ist.startOf(today), Ist.endOf(today))
                .query((rs, n) -> byMode.put(rs.getString("mode"), rs.getLong("total"))).list();
        long outstanding = db.sql("SELECT coalesce(sum(total - paid), 0) FROM invoices WHERE status IN ('UNPAID','PARTIAL')").query(Long.class).single();
        return new Summary(byMode, byMode.values().stream().mapToLong(Long::longValue).sum(), outstanding);
    }

    public record DayBookPayment(PaymentRow payment, int invoiceNumber, String contactName) {
    }

    public record Flag(String action, UUID invoiceId, String actorName, Map<String, Object> data, OffsetDateTime createdAt) {
    }

    public record DayBook(LocalDate date, List<DayBookPayment> payments, Map<String, Long> byMode, Map<String, Map<String, Long>> byStaff,
                          List<Flag> flags) {
    }

    /** End-of-day cash control: every rupee received, who received it, and every discount or void. */
    @Transactional(readOnly = true)
    public DayBook dayBook(LocalDate date) {
        List<DayBookPayment> rows = db.sql("""
                        SELECT p.*, u.name AS received_by_name, i.number, c.name AS contact_name FROM payments p
                        JOIN invoices i ON i.id = p.invoice_id JOIN contacts c ON c.id = i.contact_id
                        LEFT JOIN users u ON u.id = p.received_by
                        WHERE p.received_at >= ? AND p.received_at < ? ORDER BY p.received_at""")
                .params(Ist.startOf(date), Ist.endOf(date))
                .query((rs, n) -> new DayBookPayment(PAYMENT_ROW.mapRow(rs, n), rs.getInt("number"), rs.getString("contact_name")))
                .list();
        Map<String, Long> byMode = new LinkedHashMap<>();
        PAYMENT_MODES.forEach(m -> byMode.put(m, 0L));
        Map<String, Map<String, Long>> byStaff = new LinkedHashMap<>();
        for (DayBookPayment r : rows) {
            byMode.merge(r.payment().mode(), r.payment().amount(), Long::sum);
            String who = r.payment().receivedByName() == null ? "Unknown" : r.payment().receivedByName();
            byStaff.computeIfAbsent(who, k -> new HashMap<>(Map.of("cash", 0L, "other", 0L)))
                    .merge("CASH".equals(r.payment().mode()) ? "cash" : "other", r.payment().amount(), Long::sum);
        }
        List<Flag> flags = db.sql("""
                        SELECT action, entity_id, actor_name, data, created_at FROM audit_logs
                        WHERE created_at >= ? AND created_at < ? AND action IN ('invoice.voided', 'invoice.created_with_discount')
                        ORDER BY created_at""")
                .params(Ist.startOf(date), Ist.endOf(date))
                .query((rs, n) -> new Flag(rs.getString("action"), UUID.fromString(rs.getString("entity_id")), rs.getString("actor_name"),
                        com.arcus.platform.support.Json.map(rs.getString("data")), Sql.time(rs, "created_at")))
                .list();
        return new DayBook(date, rows, byMode, byStaff, flags);
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
