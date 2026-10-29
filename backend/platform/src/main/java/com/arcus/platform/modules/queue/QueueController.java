package com.arcus.platform.modules.queue;

import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.orgs.OrgService;
import com.arcus.platform.publiclinks.PublicLinks;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
public class QueueController {

    private final QueueService queue;
    private final ContactService contacts;
    private final OrgService orgs;
    private final PublicLinks links;

    public QueueController(QueueService queue, ContactService contacts, OrgService orgs, PublicLinks links) {
        this.queue = queue;
        this.contacts = contacts;
        this.orgs = orgs;
        this.links = links;
    }

    @GetMapping("/api/modules/queue")
    public QueueService.Board board() {
        return queue.board();
    }

    @GetMapping("/api/modules/queue/summary")
    public QueueService.Summary summary() {
        return queue.summary();
    }

    public record TokenRequest(UUID contactId, UUID providerId) {
    }

    @PostMapping("/api/modules/queue/tokens")
    public QueueService.Entry issue(@RequestBody TokenRequest body) {
        return queue.issueToken(body.contactId(), body.providerId(), null);
    }

    public record WalkIn(QueueService.Entry entry, String contactName) {
    }

    /** Reception's quick walk-in: reuse the contact if this name + mobile exists, else register, then issue a token. */
    @PostMapping("/api/modules/queue/walk-in")
    public WalkIn walkIn(@RequestBody ContactService.ContactInput body) {
        AppRegistry.requireModule(QueueModule.ID);
        var contact = contacts.findOrCreate(body);
        return new WalkIn(queue.issueToken(contact.id(), null, null), contact.name());
    }

    public record Status(String status) {
    }

    @PostMapping("/api/modules/queue/entries/{id}/status")
    public QueueService.Entry status(@PathVariable UUID id, @RequestBody Status body) {
        return queue.setStatus(id, body.status());
    }

    @PostMapping("/api/modules/queue/call-next")
    public Map<String, Object> callNext() {
        return queue.callNext().<Map<String, Object>>map(e -> Map.of("entry", e)).orElse(Map.of());
    }

    public record Delay(int minutes) {
    }

    @PostMapping("/api/modules/queue/delay")
    public Map<String, Integer> delay(@RequestBody Delay body) {
        return Map.of("notified", queue.delayNotice(body.minutes()));
    }

    public record Settings(int avgMinutes) {
    }

    @GetMapping("/api/modules/queue/settings")
    public Settings settings() {
        AppRegistry.requireModule(QueueModule.ID);
        return new Settings(QueueService.configuredMinutes(orgs.settings()));
    }

    @PutMapping("/api/modules/queue/settings")
    public Settings updateSettings(@RequestBody Settings body) {
        AppRegistry.requireModule(QueueModule.ID);
        orgs.mergeSettings(Map.of("queueAvgMinutes", Math.min(Math.max(body.avgMinutes(), 2), 120)));
        return settings();
    }

    @GetMapping("/api/public/tokens/{code}")
    public QueueService.TokenStatus token(@PathVariable String code) {
        UUID orgId = links.ownerOf("queue_entries", code).orElseThrow(() -> new UserError.NotFound("Token"));
        return links.asOrg(orgId, () -> queue.tokenStatus(code));
    }

    @GetMapping("/api/public/display/{slug}")
    public QueueService.Display display(@PathVariable String slug) {
        UUID orgId = links.orgBySlug(slug).orElseThrow(() -> new UserError.NotFound("Practice"));
        return links.asOrg(orgId, queue::display);
    }
}
