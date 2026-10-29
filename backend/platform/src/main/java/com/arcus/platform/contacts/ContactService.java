package com.arcus.platform.contacts;

import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.TenantContext;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.spi.FieldDef;
import com.arcus.platform.support.Ist;
import com.arcus.platform.support.Strings;
import com.arcus.platform.support.Json;
import com.arcus.platform.support.Phones;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class ContactService {

    private final JdbcClient db;
    private final AppRegistry registry;

    public ContactService(JdbcClient db, AppRegistry registry) {
        this.db = db;
        this.registry = registry;
    }

    /** Contact form, shared by create and edit. Age is accepted when the date of birth is not known. */
    public record ContactInput(String name, String phone, String email, String gender, LocalDate dob, Integer age, String address,
                               String preferredLang, Boolean whatsappOptIn, Map<String, String> fields) {
    }

    private record Clean(String name, String phone, String email, String gender, LocalDate dob, String address, String lang,
                         boolean optIn, String fieldsJson) {
    }

    private Clean clean(ContactInput in) {
        String name = in.name() == null ? "" : in.name().trim();
        if (name.length() < 2) throw new UserError("Please enter the full name.");
        String phone = Phones.normalize(in.phone()).orElseThrow(() -> new UserError("Please enter a valid 10-digit mobile number."));
        LocalDate dob = in.dob();
        if (dob == null && in.age() != null && in.age() >= 0 && in.age() < 120) dob = Ist.today().minusYears(in.age());
        Map<String, String> fields = new LinkedHashMap<>();
        List<FieldDef> defs = registry.app(TenantContext.require().app()).contactFields();
        for (FieldDef f : defs) {
            String v = in.fields() == null ? null : in.fields().get(f.key());
            if (v != null && !v.isBlank()) fields.put(f.key(), v.trim().length() > 300 ? v.trim().substring(0, 300) : v.trim());
        }
        String gender = Strings.oneOf(in.gender(), "M", "F", "O") ? in.gender() : null;
        return new Clean(name.length() > 120 ? name.substring(0, 120) : name, phone, blank(in.email()), gender, dob, blank(in.address()),
                "hi".equals(in.preferredLang()) ? "hi" : "en", Boolean.TRUE.equals(in.whatsappOptIn()), Json.write(fields));
    }

    @Transactional
    public Contact create(ContactInput in) {
        Principal p = TenantContext.require();
        Clean c = clean(in);
        UUID id = db.sql("""
                        INSERT INTO contacts (org_id, name, phone, email, gender, dob, address, preferred_lang, whatsapp_opt_in, consent_at, fields)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb) RETURNING id""")
                .params(p.orgId(), c.name(), c.phone(), c.email(), c.gender(), c.dob(), c.address(), c.lang(), c.optIn(),
                        c.optIn() ? Ist.now() : null, c.fieldsJson())
                .query(UUID.class).single();
        return get(id);
    }

    @Transactional
    public Contact update(UUID id, ContactInput in) {
        Contact existing = get(id);
        Clean c = clean(in);
        OffsetDateTime consentAt = c.optIn() ? (existing.consentAt() != null ? existing.consentAt() : Ist.now()) : null;
        db.sql("""
                        UPDATE contacts SET name = ?, phone = ?, email = ?, gender = ?, dob = ?, address = ?, preferred_lang = ?,
                        whatsapp_opt_in = ?, consent_at = ?, fields = ?::jsonb WHERE id = ?""")
                .params(c.name(), c.phone(), c.email(), c.gender(), c.dob(), c.address(), c.lang(), c.optIn(), consentAt, c.fieldsJson(), id)
                .update();
        return get(id);
    }

    @Transactional(readOnly = true)
    public Optional<Contact> find(UUID id) {
        return db.sql("SELECT * FROM contacts WHERE id = ?").param(id).query(Contact.ROW).optional();
    }

    @Transactional(readOnly = true)
    public Contact get(UUID id) {
        return find(id).orElseThrow(() -> new UserError.NotFound("Contact"));
    }

    /** Reuse the contact if this exact name + mobile is already registered, else create one. */
    @Transactional
    public Contact findOrCreate(ContactInput in) {
        Optional<String> phone = Phones.normalize(in.phone());
        if (phone.isPresent() && in.name() != null && !in.name().isBlank()) {
            Optional<Contact> existing = db.sql("SELECT * FROM contacts WHERE phone = ? AND lower(name) = lower(?) LIMIT 1")
                    .params(phone.get(), in.name().trim()).query(Contact.ROW).optional();
            if (existing.isPresent()) return existing.get();
        }
        return create(in);
    }

    public record ListItem(Contact contact, long visits, OffsetDateTime lastSeen) {
    }

    /** Search by name or by any part of the phone number, with visit counts. */
    @Transactional(readOnly = true)
    public List<ListItem> search(String q, int limit) {
        String query = q == null ? "" : q.trim();
        String digits = query.replaceAll("\\D", "");
        return db.sql("""
                        SELECT c.*, (SELECT count(*) FROM encounters e WHERE e.contact_id = c.id) AS visits,
                               (SELECT max(e.occurred_at) FROM encounters e WHERE e.contact_id = c.id) AS last_seen
                        FROM contacts c
                        WHERE (:q = '' OR c.name ILIKE '%' || :q || '%' OR (length(:digits) >= 3 AND c.phone LIKE '%' || :digits || '%'))
                        ORDER BY c.created_at DESC LIMIT :limit""")
                .param("q", query).param("digits", digits).param("limit", Math.min(Math.max(limit, 1), 200))
                .query((rs, n) -> new ListItem(Contact.ROW.mapRow(rs, n), rs.getLong("visits"), Sql.time(rs, "last_seen")))
                .list();
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
