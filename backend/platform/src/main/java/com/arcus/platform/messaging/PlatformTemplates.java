package com.arcus.platform.messaging;

import com.arcus.platform.spi.Template;

import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Generic wording for platform messages. Apps and modules override any key with their own wording. */
public final class PlatformTemplates {

    public static final Map<String, Template> MESSAGES = Map.of(
            "APPOINTMENT_BOOKED", new Template(
                    "Namaste {{name}}, your appointment at {{org}} is confirmed for {{when}}. Address: {{address}}",
                    "नमस्ते {{name}}, {{org}} में आपका अपॉइंटमेंट {{when}} के लिए पक्का है। पता: {{address}}"),
            "FOLLOW_UP_REMINDER", new Template(
                    "Namaste {{name}}, a reminder from {{org}}: {{title}} is due on {{date}}.",
                    "नमस्ते {{name}}, {{org}} की ओर से याद दिलाना: {{title}} की तारीख {{date}} है।"),
            "DOCUMENT_SHARED", new Template(
                    "{{name}}, a document from {{org}} has been shared with you: {{link}}",
                    "{{name}}, {{org}} ने आपके साथ एक दस्तावेज़ साझा किया है: {{link}}"),
            "RECEIPT", new Template(
                    "{{org}}: Received {{amount}} from {{name}}. Receipt: {{link}}. Thank you.",
                    "{{org}}: {{name}} से {{amount}} प्राप्त हुए। रसीद: {{link}}। धन्यवाद।"));

    private static final Pattern VAR = Pattern.compile("\\{\\{(\\w+)}}");

    private PlatformTemplates() {
    }

    /** Fill {{placeholders}}; unknown ones become empty. */
    public static String render(String template, Map<String, ?> vars) {
        Matcher m = VAR.matcher(template);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            Object v = vars.get(m.group(1));
            m.appendReplacement(out, Matcher.quoteReplacement(v == null ? "" : String.valueOf(v)));
        }
        m.appendTail(out);
        return out.toString();
    }
}
