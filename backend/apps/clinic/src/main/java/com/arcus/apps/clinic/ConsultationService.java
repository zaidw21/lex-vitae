package com.arcus.apps.clinic;

import com.arcus.platform.billing.BillingService;
import com.arcus.platform.contacts.Contact;
import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.documents.DocumentService;
import com.arcus.platform.encounters.EncounterService;
import com.arcus.platform.kernel.AppRegistry;
import com.arcus.platform.kernel.ArcusProperties;
import com.arcus.platform.kernel.Principal;
import com.arcus.platform.kernel.web.UserError;
import com.arcus.platform.messaging.NotificationService;
import com.arcus.platform.modules.queue.QueueService;
import com.arcus.platform.orgs.OrgService;
import com.arcus.platform.support.Ist;
import com.arcus.platform.tasks.TaskService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Everything that happens when a doctor finishes a consultation, in one transaction. */
@Service
public class ConsultationService {

    private final ContactService contacts;
    private final EncounterService encounters;
    private final DocumentService documents;
    private final TaskService tasks;
    private final BillingService billing;
    private final QueueService queue;
    private final NotificationService notifications;
    private final OrgService orgs;
    private final ArcusProperties props;

    public ConsultationService(ContactService contacts, EncounterService encounters, DocumentService documents, TaskService tasks,
                               BillingService billing, QueueService queue, NotificationService notifications, OrgService orgs, ArcusProperties props) {
        this.contacts = contacts;
        this.encounters = encounters;
        this.documents = documents;
        this.tasks = tasks;
        this.billing = billing;
        this.queue = queue;
        this.notifications = notifications;
        this.orgs = orgs;
        this.props = props;
    }

    public record Consultation(UUID contactId, UUID queueEntryId, Map<String, String> vitals, String complaints, String findings,
                               String diagnosis, String advice, List<Rx.Item> items, Integer followUpDays, Long fee, String paymentMode,
                               boolean sendWhatsApp) {
    }

    @Transactional
    public DocumentService.Document save(Consultation in) {
        Principal p = AppRegistry.requireApp(ClinicApp.ID);
        Contact contact = contacts.get(in.contactId());
        QueueService.Entry entry = null;
        if (in.queueEntryId() != null) {
            entry = queue.get(in.queueEntryId());
            if (!entry.contactId().equals(contact.id())) throw new UserError("This token belongs to someone else.");
        }
        LocalDate followUpOn = in.followUpDays() != null && in.followUpDays() > 0 ? Ist.today().plusDays(in.followUpDays()) : null;

        Map<String, Object> clinical = new LinkedHashMap<>();
        clinical.put("vitals", in.vitals() == null ? Map.of() : in.vitals());
        clinical.put("complaints", nz(in.complaints()));
        clinical.put("findings", nz(in.findings()));
        clinical.put("diagnosis", nz(in.diagnosis()));
        clinical.put("advice", nz(in.advice()));
        String summary = !nz(in.diagnosis()).isEmpty() ? in.diagnosis() : !nz(in.complaints()).isEmpty() ? in.complaints() : null;

        UUID encounterId = encounters.create(new EncounterService.NewEncounter(contact.id(), entry == null ? null : entry.id(), null, null,
                "CONSULTATION", null, summary, clinical, followUpOn));

        OrgService.Member me = orgs.me();
        Map<String, Object> rx = new LinkedHashMap<>(clinical);
        rx.put("items", in.items());
        rx.put("followUpOn", followUpOn == null ? null : followUpOn.toString());
        rx.put("issuedBy", Map.of("name", p.userName(), "qualifications", nz(me.qualifications()), "registrationNo", nz(me.registrationNo())));
        DocumentService.Document doc = documents.create(contact.id(), encounterId, "PRESCRIPTION", "Prescription", rx);

        if (followUpOn != null) tasks.create(new TaskService.NewTask("Follow-up visit", followUpOn, contact.id(), "FOLLOW_UP", null, null));
        if (entry != null) queue.complete(entry.id());
        if (in.fee() != null) {
            long fee = Math.max(0, in.fee());
            BillingService.Payment payment = in.paymentMode() != null && fee > 0 ? new BillingService.Payment(fee, in.paymentMode(), null) : null;
            billing.create(new BillingService.NewInvoice(contact.id(), encounterId, null, null,
                    List.of(new BillingService.Line(fee == 0 ? "Follow-up consultation (free)" : "Consultation", 1, fee)), 0, null, payment, false));
        }
        if (in.sendWhatsApp()) notifications.notify(contact, "DOCUMENT_SHARED", Map.of("link", props.link("/d/" + doc.publicCode())));
        return doc;
    }

    public record Settings(long consultationFee, long followUpFee, int followUpFreeDays) {
    }

    /** Fees in rupees, with defaults. */
    public Settings settings() {
        Map<String, Object> s = orgs.settings();
        return new Settings(num(s.get("consultationFee"), 400), num(s.get("followUpFee"), 0), (int) num(s.get("followUpFreeDays"), 7));
    }

    public record Fee(long amount, String reason) {
    }

    /** Consultation fee for this patient today (paise): free/reduced within the follow-up window. */
    @Transactional(readOnly = true)
    public Fee suggestedFee(UUID contactId) {
        Settings s = settings();
        var last = encounters.forContact(contactId, "CONSULTATION", 1);
        if (!last.isEmpty() && last.getFirst().occurredAt().isAfter(Ist.now().minusDays(s.followUpFreeDays()))) {
            return new Fee(s.followUpFee() * 100, "Follow-up within " + s.followUpFreeDays() + " days of last visit");
        }
        return new Fee(s.consultationFee() * 100, last.isEmpty() ? "New patient" : "Returning patient");
    }

    private static long num(Object v, long fallback) {
        return v instanceof Number n ? n.longValue() : fallback;
    }

    private static String nz(String s) {
        return s == null ? "" : s.trim();
    }
}
