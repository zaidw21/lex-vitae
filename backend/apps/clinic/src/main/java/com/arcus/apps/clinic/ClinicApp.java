package com.arcus.apps.clinic;

import com.arcus.platform.spi.AppDefinition;
import com.arcus.platform.spi.FieldDef;
import com.arcus.platform.spi.ServiceDefault;
import com.arcus.platform.spi.Template;
import com.arcus.platform.spi.Terms;
import com.arcus.platform.support.Json;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Arcus Clinic: the doctors' app. Uses the queue and appointments modules plus its own consultations. */
@Component
public class ClinicApp implements AppDefinition {

    public static final String ID = "clinic";

    @Override
    public String id() {
        return ID;
    }

    @Override
    public String name() {
        return "Arcus Clinic";
    }

    @Override
    public String tagline() {
        return "OPD queue, prescriptions, billing and follow-ups for clinics";
    }

    @Override
    public Terms terms() {
        return new Terms("Clinic", "Patient", "Patients", "Doctor", "Consultation", "Consultations");
    }

    @Override
    public String practitionerPrefix() {
        return "Dr.";
    }

    @Override
    public List<String> modules() {
        return List.of("queue", "appointments");
    }

    @Override
    public List<FieldDef> contactFields() {
        return List.of(
                FieldDef.select("bloodGroup", "Blood group", List.of("", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-")),
                FieldDef.text("allergies", "Allergies", "e.g. Penicillin, sulfa"),
                FieldDef.text("conditions", "Chronic conditions", "e.g. Diabetes, hypertension"),
                FieldDef.text("guardian", "Guardian / relative", null));
    }

    @Override
    public List<ServiceDefault> defaultServices() {
        return List.of(
                new ServiceDefault("Consultation", 400),
                new ServiceDefault("Follow-up consultation", 200),
                new ServiceDefault("Dressing", 150),
                new ServiceDefault("Injection (administration)", 100),
                new ServiceDefault("Nebulization", 200),
                new ServiceDefault("ECG", 300));
    }

    @Override
    public Map<String, Object> defaultSettings() {
        return Map.of("consultationFee", 400, "followUpFee", 200, "followUpFreeDays", 7, "queueAvgMinutes", 8);
    }

    @Override
    public Map<String, Template> messages() {
        return Map.of(
                "TOKEN_ISSUED", new Template(
                        "Namaste {{name}}, your token at {{org}} is #{{token}}. {{ahead}} patient(s) ahead of you. Track your turn live: {{link}}",
                        "नमस्ते {{name}}, {{org}} में आपका टोकन नंबर #{{token}} है। आपसे पहले {{ahead}} मरीज़ हैं। अपनी बारी यहाँ देखें: {{link}}"),
                "TURN_NEAR", new Template(
                        "{{name}}, your turn at {{org}} is coming up (token #{{token}}). Please be near the cabin.",
                        "{{name}}, {{org}} में आपकी बारी आने वाली है (टोकन #{{token}})। कृपया केबिन के पास रहें।"),
                "DELAY_NOTICE", new Template(
                        "{{org}}: The doctor is running about {{minutes}} minutes late today. Sorry for the wait. Live status: {{link}}",
                        "{{org}}: आज डॉक्टर लगभग {{minutes}} मिनट देरी से हैं। असुविधा के लिए खेद है। लाइव स्थिति: {{link}}"),
                "FOLLOW_UP_REMINDER", new Template(
                        "Namaste {{name}}, this is a reminder from {{org}} that your follow-up visit is due on {{date}}. Reply to book a time.",
                        "नमस्ते {{name}}, {{org}} की ओर से याद दिलाना है कि आपकी फॉलो-अप जाँच {{date}} को है। समय बुक करने के लिए जवाब दें।"),
                "DOCUMENT_SHARED", new Template(
                        "{{name}}, your prescription from {{org}} is ready: {{link}}. Get well soon!",
                        "{{name}}, {{org}} से आपका पर्चा तैयार है: {{link}}। जल्दी स्वस्थ हों!"));
    }

    @Override
    public void provision(UUID orgId, JdbcClient db) {
        for (Rx.Item m : Rx.STARTER_MEDICINES) {
            db.sql("INSERT INTO catalog_items (org_id, kind, name, data) VALUES (?, 'MEDICINE', ?, ?::jsonb)")
                    .params(orgId, m.name(), Json.write(Rx.favouriteData(m))).update();
        }
    }
}
