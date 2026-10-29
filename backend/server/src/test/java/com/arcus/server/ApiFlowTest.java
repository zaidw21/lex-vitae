package com.arcus.server;

import com.arcus.platform.testing.TestDatabase;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** The main flows through the real HTTP API, as the web app uses them. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiFlowTest {

    @DynamicPropertySource
    static void db(DynamicPropertyRegistry registry) {
        TestDatabase.register(registry);
    }

    @LocalServerPort int port;

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private final HttpClient http = HttpClient.newHttpClient();

    record Res(int status, JsonNode body) {
    }

    Res call(String method, String path, Object body, String token) throws Exception {
        HttpRequest.Builder b = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path))
                .header("Content-Type", "application/json")
                .method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(JSON.writeValueAsString(body)));
        if (token != null) b.header("Authorization", "Bearer " + token);
        HttpResponse<String> r = http.send(b.build(), HttpResponse.BodyHandlers.ofString());
        return new Res(r.statusCode(), r.body().isBlank() ? JSON.createObjectNode() : JSON.readTree(r.body()));
    }

    String signup(String app) throws Exception {
        String email = app + "-" + UUID.randomUUID() + "@example.com";
        Res r = call("POST", "/api/auth/signup", Map.of("name", "Dr. Test", "email", email, "phone", "9988776655", "password", "password123",
                "orgName", "Test " + app, "city", "Indore", "app", app), null);
        assertThat(r.status()).as(r.body().toString()).isEqualTo(200);
        return r.body().get("token").asString();
    }

    @Test
    void clinicDayFromWalkInToReceipt() throws Exception {
        String t = signup("clinic");
        Res session = call("GET", "/api/session", null, t);
        assertThat(session.body().at("/app/name").asString()).isEqualTo("Arcus Clinic");

        Res walkIn = call("POST", "/api/modules/queue/walk-in", Map.of("name", "Asha Verma", "phone", "9876543210", "age", 34, "preferredLang", "hi",
                "whatsappOptIn", true), t);
        assertThat(walkIn.status()).isEqualTo(200);
        String entryId = walkIn.body().at("/entry/id").asString();
        String contactId = walkIn.body().at("/entry/contactId").asString();
        assertThat(walkIn.body().at("/entry/tokenNumber").asInt()).isEqualTo(1);

        assertThat(call("POST", "/api/modules/queue/call-next", Map.of(), t).body().at("/entry/status").asString()).isEqualTo("IN_PROGRESS");
        Res consult = call("GET", "/api/apps/clinic/consult?entry=" + entryId, null, t);
        assertThat(consult.body().get("favourites").size()).isEqualTo(10);
        assertThat(consult.body().at("/fee/amount").asLong()).isEqualTo(40000);

        Res doc = call("POST", "/api/apps/clinic/consultations", Map.of("contactId", contactId, "entryId", entryId, "diagnosis", "Viral fever",
                "items", List.of(Map.of("name", "Tab. Paracetamol 650", "frequency", "1-1-1", "timing", "AFTER_FOOD", "days", 3)),
                "followUpDays", 7, "bill", true, "fee", "400", "paymentMode", "UPI", "sendWhatsApp", true), t);
        assertThat(doc.status()).as(doc.body().toString()).isEqualTo(200);
        assertThat(doc.body().get("type").asString()).isEqualTo("PRESCRIPTION");

        Res board = call("GET", "/api/modules/queue", null, t);
        assertThat(board.body().at("/entries/0/entry/status").asString()).isEqualTo("DONE");
        assertThat(call("GET", "/api/billing/summary", null, t).body().get("collectedToday").asLong()).isEqualTo(40000);
        Res outbox = call("GET", "/api/messages", null, t);
        assertThat(outbox.body().get("messages").valueStream().map(m -> m.get("template").asString()).toList()).contains("TOKEN_ISSUED", "DOCUMENT_SHARED");

        // every screen's read endpoint loads (catches reads that run outside a transaction, which RLS answers with no rows)
        for (String path : List.of("/api/session", "/api/team", "/api/catalog", "/api/modules/queue/settings",
                "/api/modules/queue/summary", "/api/modules/appointments", "/api/billing/invoices", "/api/billing/daybook", "/api/tasks",
                "/api/audit", "/api/dashboard", "/api/contacts", "/api/apps/clinic/settings")) {
            Res r = call("GET", path, null, t);
            assertThat(r.status()).as(path + " " + r.body()).isEqualTo(200);
        }

        // public links resolve without a session
        assertThat(call("GET", "/api/public/documents/" + doc.body().get("publicCode").asString(), null, null).status()).isEqualTo(200);
        assertThat(call("GET", "/api/public/tokens/" + walkIn.body().at("/entry/publicCode").asString(), null, null).body().get("status").asString()).isEqualTo("DONE");
    }

    @Test
    void billingControls() throws Exception {
        String t = signup("clinic");
        String contactId = call("POST", "/api/contacts", Map.of("name", "Ravi Jain", "phone", "9811111111"), t).body().get("id").asString();
        Res noReason = call("POST", "/api/billing/invoices", Map.of("contactId", contactId, "lines", List.of(Map.of("description", "ECG", "qty", 1, "unitPrice", "300")),
                "discount", "50"), t);
        assertThat(noReason.status()).isEqualTo(400);
        assertThat(noReason.body().get("error").asString()).contains("reason");
        Res inv = call("POST", "/api/billing/invoices", Map.of("contactId", contactId, "lines", List.of(Map.of("description", "ECG", "qty", 1, "unitPrice", "300")),
                "discount", "50", "notes", "Senior citizen", "paidNow", "250", "mode", "CASH"), t);
        assertThat(inv.body().get("total").asLong()).isEqualTo(25000);
        String id = inv.body().get("id").asString();
        assertThat(call("POST", "/api/billing/invoices/" + id + "/void", Map.of("reason", "Duplicate"), t).body().get("status").asString()).isEqualTo("VOID");
        Res dayBook = call("GET", "/api/billing/daybook", null, t);
        assertThat(dayBook.body().get("flags").size()).isEqualTo(2);
        assertThat(dayBook.body().at("/byMode/CASH").asLong()).isEqualTo(25000);
    }

    @Test
    void organizationsAndAppsAreIsolated() throws Exception {
        String clinic = signup("clinic");
        String legal = signup("legal");
        String contactId = call("POST", "/api/contacts", Map.of("name", "Private Patient", "phone", "9822222222"), clinic).body().get("id").asString();
        assertThat(call("GET", "/api/contacts/" + contactId, null, legal).status()).isEqualTo(404);
        assertThat(call("GET", "/api/contacts", null, legal).body().size()).isZero();
        assertThat(call("GET", "/api/modules/queue", null, legal).status()).isEqualTo(403);
        for (String path : List.of("/api/apps/legal/options", "/api/apps/legal/matters", "/api/apps/legal/hearings", "/api/modules/appointments")) {
            assertThat(call("GET", path, null, legal).status()).as(path).isEqualTo(200);
        }
        assertThat(call("GET", "/api/apps/clinic/settings", null, legal).status()).isEqualTo(403);
        assertThat(call("GET", "/api/apps/legal/hearings", null, clinic).status()).isEqualTo(403);
        assertThat(call("GET", "/api/contacts", null, null).status()).isEqualTo(401);
    }

    @Test
    void legalHearingUpdatesTheMatterAndClient() throws Exception {
        String t = signup("legal");
        Res created = call("POST", "/api/apps/legal/matters", Map.of("client", Map.of("name", "Mohit Gupta", "phone", "9833333333", "whatsappOptIn", true),
                "title", "Gupta vs. State", "court", "District Court, Indore", "nextHearingOn", com.arcus.platform.support.Ist.today().toString()), t);
        assertThat(created.status()).as(created.body().toString()).isEqualTo(200);
        String matterId = created.body().get("id").asString();
        assertThat(call("GET", "/api/apps/legal/hearings", null, t).body().get("listed").size()).isEqualTo(1);
        Res heard = call("POST", "/api/apps/legal/matters/" + matterId + "/hearings", Map.of("heldOn", com.arcus.platform.support.Ist.today().toString(),
                "outcome", "PW-1 examined", "nextDate", com.arcus.platform.support.Ist.today().plusDays(30).toString(), "notifyClient", true), t);
        assertThat(heard.status()).as(heard.body().toString()).isEqualTo(200);
        Res view = call("GET", "/api/apps/legal/matters/" + matterId, null, t);
        assertThat(view.body().get("hearings").size()).isEqualTo(1);
        assertThat(view.body().at("/matter/nextHearingOn").asString()).isEqualTo(com.arcus.platform.support.Ist.today().plusDays(30).toString());
        assertThat(call("GET", "/api/messages", null, t).body().at("/messages/0/template").asString()).isEqualTo("HEARING_UPDATE");
    }
}
