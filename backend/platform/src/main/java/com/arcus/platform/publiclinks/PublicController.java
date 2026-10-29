package com.arcus.platform.publiclinks;

import com.arcus.platform.billing.BillingService;
import com.arcus.platform.contacts.Contact;
import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.documents.DocumentService;
import com.arcus.platform.kernel.web.UserError;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Public, unauthenticated links shared over WhatsApp. */
@RestController
@RequestMapping("/api/public")
public class PublicController {

    private final PublicLinks links;
    private final DocumentService documents;
    private final BillingService billing;
    private final ContactService contacts;

    public PublicController(PublicLinks links, DocumentService documents, BillingService billing, ContactService contacts) {
        this.links = links;
        this.documents = documents;
        this.billing = billing;
        this.contacts = contacts;
    }

    public record PublicDocument(PublicLinks.PublicOrg org, DocumentService.Document document, Contact contact) {
    }

    @GetMapping("/documents/{code}")
    public PublicDocument document(@PathVariable String code) {
        UUID orgId = links.ownerOf("documents", code).orElseThrow(() -> new UserError.NotFound("Document"));
        return links.asOrg(orgId, () -> {
            UUID id = documents.byCode(code);
            DocumentService.Document doc = documents.get(id);
            return new PublicDocument(links.org(orgId), doc, contacts.get(doc.contactId()));
        });
    }

    public record PublicReceipt(PublicLinks.PublicOrg org, BillingService.InvoiceDetail invoice) {
    }

    @GetMapping("/receipts/{code}")
    public PublicReceipt receipt(@PathVariable String code) {
        UUID orgId = links.ownerOf("invoices", code).orElseThrow(() -> new UserError.NotFound("Receipt"));
        return links.asOrg(orgId, () -> new PublicReceipt(links.org(orgId), billing.detailByCode(code)));
    }
}
