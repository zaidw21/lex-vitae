package com.arcus.platform.modules.queue;

import com.arcus.platform.spi.ModuleDefinition;
import com.arcus.platform.spi.Template;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class QueueModule implements ModuleDefinition {

    public static final String ID = "queue";

    @Override
    public String id() {
        return ID;
    }

    @Override
    public String name() {
        return "Live queue";
    }

    @Override
    public String description() {
        return "Walk-in tokens, live status on WhatsApp, waiting-room screen.";
    }

    @Override
    public Map<String, Template> messages() {
        return Map.of(
                "TOKEN_ISSUED", new Template(
                        "Namaste {{name}}, your token at {{org}} is #{{token}}. {{ahead}} ahead of you. Track your turn live: {{link}}",
                        "नमस्ते {{name}}, {{org}} में आपका टोकन नंबर #{{token}} है। आपसे पहले {{ahead}} लोग हैं। अपनी बारी यहाँ देखें: {{link}}"),
                "TURN_NEAR", new Template(
                        "{{name}}, your turn at {{org}} is coming up (token #{{token}}). Please stay close by.",
                        "{{name}}, {{org}} में आपकी बारी आने वाली है (टोकन #{{token}})। कृपया पास ही रहें।"),
                "DELAY_NOTICE", new Template(
                        "{{org}}: We are running about {{minutes}} minutes late today. Sorry for the wait. Live status: {{link}}",
                        "{{org}}: आज हम लगभग {{minutes}} मिनट देरी से चल रहे हैं। असुविधा के लिए खेद है। लाइव स्थिति: {{link}}"));
    }
}
