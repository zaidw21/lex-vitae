package com.arcus.server;

import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.messaging.PlatformTemplates;
import com.arcus.platform.spi.Template;
import com.arcus.platform.testing.TestDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/** Every customer-facing message exists in English and Hindi with the same placeholders. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class TemplatesTest {

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry registry) {
        TestDatabase.register(registry);
    }

    @Autowired AppRegistry registry;

    private static Set<String> placeholders(String s) {
        Set<String> out = new TreeSet<>();
        Matcher m = Pattern.compile("\\{\\{(\\w+)}}").matcher(s);
        while (m.find()) out.add(m.group(1));
        return out;
    }

    @Test
    void everyTemplateIsBilingualAndConsistent() {
        Map<String, Map<String, Template>> sources = new HashMap<>();
        sources.put("platform", PlatformTemplates.MESSAGES);
        registry.apps().forEach(a -> sources.put("app " + a.id(), a.messages()));
        registry.apps().forEach(a -> registry.allowedModules(a).forEach(m -> sources.put("module " + m, registry.module(m).messages())));
        sources.forEach((source, templates) -> templates.forEach((key, t) -> {
            assertThat(t.en()).as(source + " " + key + " en").isNotBlank();
            assertThat(t.hi()).as(source + " " + key + " hi").isNotBlank();
            assertThat(placeholders(t.hi())).as(source + " " + key + " placeholders").isEqualTo(placeholders(t.en()));
        }));
    }
}
