package com.arcus.apps.legal;

import com.arcus.platform.billing.BillingService;
import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.encounters.EncounterService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.support.Ist;
import com.arcus.platform.tasks.TaskService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/apps/legal")
public class LegalController {

    private final MatterService matters;
    private final ContactService contacts;
    private final EncounterService encounters;
    private final BillingService billing;
    private final TaskService tasks;

    public LegalController(MatterService matters, ContactService contacts, EncounterService encounters, BillingService billing, TaskService tasks) {
        this.matters = matters;
        this.contacts = contacts;
        this.encounters = encounters;
        this.billing = billing;
        this.tasks = tasks;
    }

    public record Options(List<String> caseTypes, List<String> stages) {
    }

    @GetMapping("/options")
    public Options options() {
        AppRegistry.requireApp(LegalApp.ID);
        return new Options(LegalApp.CASE_TYPES, LegalApp.STAGES);
    }

    @GetMapping("/matters")
    public List<MatterService.Matter> list(@RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "OPEN") String status) {
        return matters.search(q, status);
    }

    /** Create for an existing client (contactId) or a new one (client = name + mobile, matched or registered). */
    public record NewMatter(UUID contactId, ContactService.ContactInput client, String title, String caseNumber, String cnr, String court,
                            String caseType, String oppositeParty, String stage, LocalDate nextHearingOn) {
    }

    @PostMapping("/matters")
    public Map<String, UUID> create(@RequestBody NewMatter in) {
        AppRegistry.requireApp(LegalApp.ID);
        UUID contactId = in.contactId() != null ? in.contactId() : contacts.findOrCreate(in.client()).id();
        return Map.of("id", matters.create(new MatterService.NewMatter(contactId, in.title(), in.caseNumber(), in.cnr(), in.court(),
                in.caseType(), in.oppositeParty(), in.stage(), in.nextHearingOn())));
    }

    public record MatterView(MatterService.Matter matter, List<EncounterService.Encounter> hearings, List<BillingService.Invoice> invoices,
                             List<TaskService.Task> tasks) {
    }

    @GetMapping("/matters/{id}")
    @Transactional(readOnly = true)
    public MatterView get(@PathVariable UUID id) {
        MatterService.Matter m = matters.get(id);
        String ref = m.id().toString();
        return new MatterView(m, encounters.forRef(MatterService.REF, ref), billing.list("all", null, MatterService.REF, ref, 100),
                tasks.forRef(MatterService.REF, ref));
    }

    @PostMapping("/matters/{id}/hearings")
    public Map<String, Boolean> hearing(@PathVariable UUID id, @RequestBody MatterService.Hearing in) {
        matters.recordHearing(id, in);
        return Map.of("ok", true);
    }

    public record Status(String status) {
    }

    @PostMapping("/matters/{id}/status")
    public Map<String, Boolean> status(@PathVariable UUID id, @RequestBody Status in) {
        matters.setStatus(id, in.status());
        return Map.of("ok", true);
    }

    @GetMapping("/hearings")
    public MatterService.Diary diary(@RequestParam(required = false) LocalDate date) {
        return matters.diary(date == null ? Ist.today() : date);
    }

    @GetMapping("/clients/{contactId}/matters")
    public List<MatterService.Matter> forClient(@PathVariable UUID contactId) {
        return matters.forClient(contactId);
    }
}
