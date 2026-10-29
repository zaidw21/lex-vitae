package com.arcus.platform.contacts;

import com.arcus.platform.support.Json;
import com.arcus.platform.support.Sql;
import org.springframework.jdbc.core.RowMapper;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.Period;
import java.util.Map;
import java.util.UUID;

/** A person the practice serves (patient, client, ...). */
public record Contact(UUID id, String name, String phone, String email, String gender, LocalDate dob, Integer age, String address,
                      String preferredLang, boolean whatsappOptIn, OffsetDateTime consentAt, Map<String, Object> fields,
                      OffsetDateTime createdAt) {

    public static final RowMapper<Contact> ROW = (rs, n) -> {
        LocalDate dob = Sql.date(rs, "dob");
        return new Contact(Sql.uuid(rs, "id"), rs.getString("name"), rs.getString("phone"), rs.getString("email"),
                rs.getString("gender"), dob, dob == null ? null : Period.between(dob, com.arcus.platform.support.Ist.today()).getYears(),
                rs.getString("address"), rs.getString("preferred_lang"), rs.getBoolean("whatsapp_opt_in"), Sql.time(rs, "consent_at"),
                Json.map(rs.getString("fields")), Sql.time(rs, "created_at"));
    };
}
