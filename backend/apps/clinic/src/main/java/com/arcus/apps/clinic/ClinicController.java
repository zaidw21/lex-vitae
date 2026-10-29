package com.arcus.apps.clinic;

import com.arcus.platform.contacts.Contact;
import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.documents.DocumentService;
import com.arcus.platform.encounters.EncounterService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.modules.queue.QueueService;
import com.arcus.platform.orgs.CatalogService;
import com.arcus.platform.orgs.OrgService;
import com.arcus.platform.support.Money;
import com.arcus.platform.support.Strings;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/apps/clinic")
public class ClinicController {

    private final ConsultationService consultations;
    private final ContactService contacts;
    private final EncounterService encounters;
    private final DocumentService documents;
    private final QueueService queue;
    private final CatalogService catalog;
    private final OrgService orgs;

    public ClinicController(ConsultationService consultations, ContactService contacts, EncounterService encounters, DocumentService documents,
                            QueueService queue, CatalogService catalog, OrgService orgs) {
        this.consultations = consultations;
        this.contacts = contacts;
        this.encounters = encounters;
        this.documents = documents;
        this.queue = queue;
        this.catalog = catalog;
        this.orgs = orgs;
    }

    public record Visit(EncounterService.Encounter encounter, UUID documentId) {
    }

    public record ConsultView(Contact contact, QueueService.Entry entry, UUID existingDocumentId, List<Visit> history,
                              List<CatalogService.Item> favourites, List<Object> previousItems, ConsultationService.Fee fee) {
    }

    /** Everything the consultation screen needs, for a queue entry or a contact. */
    @GetMapping("/consult")
    @Transactional(readOnly = true)
    public ConsultView consult(@RequestParam(required = false) UUID entry, @RequestParam(required = false) UUID contact) {
        AppRegistry.requireApp(ClinicApp.ID);
        QueueService.Entry e = entry == null ? null : queue.get(entry);
        UUID contactId = e != null ? e.contactId() : contact;
        if (contactId == null) throw new UserError.NotFound("Patient");
        Contact c = contacts.get(contactId);
        UUID existing = e == null ? null : encounters.forQueueEntry(e.id())
                .flatMap(enc -> documents.forEncounters(List.of(enc.id())).stream().findFirst()).map(DocumentService.Document::id).orElse(null);
        var history = encounters.forContact(contactId, "CONSULTATION", 5);
        var docs = documents.forEncounters(history.stream().map(EncounterService.Encounter::id).toList());
        List<Visit> visits = history.stream().map(h -> new Visit(h, docs.stream().filter(d -> h.id().equals(d.encounterId()))
                .map(DocumentService.Document::id).findFirst().orElse(null))).toList();
        List<Object> previous = history.stream()
                .flatMap(h -> docs.stream().filter(d -> h.id().equals(d.encounterId())))
                .findFirst().map(d -> d.data().get("items")).filter(List.class::isInstance).map(o -> (List<Object>) o).orElse(List.of());
        return new ConsultView(c, e, existing, visits, catalog.list("MEDICINE"), previous, consultations.suggestedFee(contactId));
    }

    public record ConsultationIn(UUID contactId, UUID entryId, Map<String, String> vitals, String complaints, String findings, String diagnosis,
                                 String advice, List<Map<String, Object>> items, Integer followUpDays, boolean bill, String fee,
                                 String paymentMode, boolean sendWhatsApp) {
    }

    @PostMapping("/consultations")
    public DocumentService.Document save(@RequestBody ConsultationIn in) {
        String mode = Strings.oneOf(in.paymentMode(), "CASH", "UPI", "CARD") ? in.paymentMode() : null;
        Map<String, String> vitals = new LinkedHashMap<>();
        if (in.vitals() != null) in.vitals().forEach((k, v) -> { if (v != null && !v.isBlank()) vitals.put(k, v.trim()); });
        return consultations.save(new ConsultationService.Consultation(in.contactId(), in.entryId(), vitals, in.complaints(), in.findings(),
                in.diagnosis(), in.advice(), Rx.sanitize(in.items()), in.followUpDays(), in.bill() ? Money.rupeesToPaise(in.fee()) : null,
                mode, in.sendWhatsApp()));
    }

    @GetMapping("/settings")
    public ConsultationService.Settings settings() {
        AppRegistry.requireApp(ClinicApp.ID);
        return consultations.settings();
    }

    @PutMapping("/settings")
    public ConsultationService.Settings updateSettings(@RequestBody ConsultationService.Settings in) {
        AppRegistry.requireApp(ClinicApp.ID);
        orgs.mergeSettings(Map.of("consultationFee", Math.max(0, in.consultationFee()), "followUpFee", Math.max(0, in.followUpFee()),
                "followUpFreeDays", Math.max(0, in.followUpFreeDays())));
        return consultations.settings();
    }

    @GetMapping("/medicines")
    public List<CatalogService.Item> medicines() {
        AppRegistry.requireApp(ClinicApp.ID);
        return catalog.list("MEDICINE");
    }

    @PostMapping("/medicines")
    public CatalogService.Item addMedicine(@RequestBody Map<String, Object> in) {
        AppRegistry.requireApp(ClinicApp.ID);
        List<Rx.Item> items = Rx.sanitize(List.of(in));
        if (items.isEmpty()) throw new UserError("Name is required.");
        Rx.Item m = items.getFirst();
        return catalog.add("MEDICINE", m.name(), 0, Rx.favouriteData(m));
    }
}
