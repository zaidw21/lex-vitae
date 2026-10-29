package com.arcus.platform.documents;

import com.arcus.platform.contacts.Contact;
import com.arcus.platform.contacts.ContactService;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documents;
    private final ContactService contacts;

    public DocumentController(DocumentService documents, ContactService contacts) {
        this.documents = documents;
        this.contacts = contacts;
    }

    public record DocumentView(DocumentService.Document document, Contact contact) {
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public DocumentView get(@PathVariable UUID id) {
        DocumentService.Document doc = documents.get(id);
        return new DocumentView(doc, contacts.get(doc.contactId()));
    }

    @PostMapping("/{id}/share")
    public Map<String, Boolean> share(@PathVariable UUID id) {
        documents.share(id);
        return Map.of("ok", true);
    }
}
