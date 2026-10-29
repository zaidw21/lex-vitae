package com.arcus.apps.legal;

import com.arcus.platform.spi.AppDefinition;
import com.arcus.platform.spi.FieldDef;
import com.arcus.platform.spi.ServiceDefault;
import com.arcus.platform.spi.Template;
import com.arcus.platform.spi.Terms;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Arcus Legal: the advocates' app. Owns matters (legal_matters) and the hearing diary. */
@Component
public class LegalApp implements AppDefinition {

    public static final String ID = "legal";

    public static final List<String> CASE_TYPES = List.of("Civil suit", "Criminal case", "Bail application", "Writ petition",
            "Family / matrimonial", "Cheque bounce (NI Act 138)", "Consumer complaint", "Motor accident claim", "Property / revenue",
            "Arbitration", "Other");

    public static final List<String> STAGES = List.of("Filing", "Notice / service", "Appearance", "Written statement / reply",
            "Framing of issues / charges", "Evidence", "Arguments", "Judgment reserved", "Disposed");

    @Override
    public String id() {
        return ID;
    }

    @Override
    public String name() {
        return "Arcus Legal";
    }

    @Override
    public String tagline() {
        return "Matters, hearing diary, client updates and fees for advocates";
    }

    @Override
    public Terms terms() {
        return new Terms("Chamber", "Client", "Clients", "Advocate", "Hearing", "Hearings");
    }

    @Override
    public String practitionerPrefix() {
        return "Adv.";
    }

    @Override
    public List<String> modules() {
        return List.of("appointments");
    }

    @Override
    public List<FieldDef> contactFields() {
        return List.of(FieldDef.text("occupation", "Occupation", null), FieldDef.text("referredBy", "Referred by", null));
    }

    @Override
    public List<ServiceDefault> defaultServices() {
        return List.of(
                new ServiceDefault("Consultation", 2000),
                new ServiceDefault("Appearance fee (per hearing)", 3000),
                new ServiceDefault("Drafting: legal notice", 5000),
                new ServiceDefault("Drafting: petition / application", 10000),
                new ServiceDefault("Court fee & expenses", 0));
    }

    @Override
    public Map<String, Template> messages() {
        return Map.of(
                "APPOINTMENT_BOOKED", new Template(
                        "Namaste {{name}}, your meeting at {{org}} is confirmed for {{when}}. Address: {{address}}",
                        "नमस्ते {{name}}, {{org}} में आपकी मुलाक़ात {{when}} के लिए तय है। पता: {{address}}"),
                "HEARING_UPDATE", new Template(
                        "{{org}}: Update on your case {{matter}}. Today: {{outcome}}. Next date of hearing: {{next}}.",
                        "{{org}}: आपके केस {{matter}} की जानकारी। आज: {{outcome}}। अगली सुनवाई की तारीख: {{next}}।"),
                "RECEIPT", new Template(
                        "{{org}}: Received {{amount}} from {{name}} towards professional fees. Receipt: {{link}}. Thank you.",
                        "{{org}}: {{name}} से पेशेवर फीस के रूप में {{amount}} प्राप्त हुए। रसीद: {{link}}। धन्यवाद।"));
    }
}
