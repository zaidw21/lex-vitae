package com.arcus.platform.contacts;

import com.arcus.platform.billing.BillingService;
import com.arcus.platform.documents.DocumentService;
import com.arcus.platform.encounters.EncounterService;
import com.arcus.platform.messaging.NotificationService;
import com.arcus.platform.tasks.TaskService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/contacts")
public class ContactController {

    private final ContactService contacts;
    private final EncounterService encounters;
    private final DocumentService documents;
    private final BillingService billing;
    private final TaskService tasks;
    private final NotificationService notifications;

    public ContactController(ContactService contacts, EncounterService encounters, DocumentService documents, BillingService billing,
                             TaskService tasks, NotificationService notifications) {
        this.contacts = contacts;
        this.encounters = encounters;
        this.documents = documents;
        this.billing = billing;
        this.tasks = tasks;
        this.notifications = notifications;
    }

    @GetMapping
    public List<ContactService.ListItem> search(@RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "100") int limit) {
        return contacts.search(q, limit);
    }

    @PostMapping
    public Contact create(@RequestBody ContactService.ContactInput body) {
        return contacts.create(body);
    }

    /** Find this exact name + mobile, or register a new contact. */
    @PostMapping("/find-or-create")
    public Contact findOrCreate(@RequestBody ContactService.ContactInput body) {
        return contacts.findOrCreate(body);
    }

    @PutMapping("/{id}")
    public Contact update(@PathVariable UUID id, @RequestBody ContactService.ContactInput body) {
        return contacts.update(id, body);
    }

    public record EncounterWithDocuments(EncounterService.Encounter encounter, List<DocumentService.Document> documents) {
    }

    public record Profile(Contact contact, List<EncounterWithDocuments> encounters, List<BillingService.Invoice> invoices,
                          List<TaskService.Task> tasks, List<NotificationService.Message> messages) {
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public Profile profile(@PathVariable UUID id) {
        Contact contact = contacts.get(id);
        var list = encounters.forContact(id, null, 30);
        var docs = documents.forEncounters(list.stream().map(EncounterService.Encounter::id).toList());
        var withDocs = list.stream().map(e -> new EncounterWithDocuments(e, docs.stream().filter(d -> e.id().equals(d.encounterId())).toList())).toList();
        return new Profile(contact, withDocs, billing.list("all", id, null, null, 20), tasks.forContact(id), notifications.list(false, id, 10));
    }
}
