package com.arcus.platform.billing;

import com.arcus.platform.support.Money;
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
@RequestMapping("/api/billing")
public class BillingController {

    private final BillingService billing;

    public BillingController(BillingService billing) {
        this.billing = billing;
    }

    @GetMapping("/invoices")
    public List<BillingService.Invoice> list(@RequestParam(defaultValue = "all") String filter, @RequestParam(required = false) String refType,
                                             @RequestParam(required = false) String refId) {
        return billing.list(filter, null, refType, refId, 100);
    }

    @GetMapping("/summary")
    public BillingService.Summary summary() {
        return billing.summary();
    }

    /** Amounts arrive as rupee strings typed by staff ("1,250.50") and are converted to paise here. */
    public record LineIn(String description, int qty, String unitPrice) {
    }

    public record NewInvoice(UUID contactId, String refType, String refId, List<LineIn> lines, String discount, String notes,
                             String paidNow, String mode, String reference, boolean sendReceipt) {
    }

    @PostMapping("/invoices")
    public BillingService.Invoice create(@RequestBody NewInvoice in) {
        List<BillingService.Line> lines = in.lines() == null ? List.of()
                : in.lines().stream().limit(50).map(l -> new BillingService.Line(l.description(), l.qty(), Money.rupeesToPaise(l.unitPrice()))).toList();
        BillingService.Payment payment = in.mode() == null || in.mode().isBlank() ? null
                : new BillingService.Payment(Money.rupeesToPaise(in.paidNow()), in.mode(), in.reference());
        boolean hasRef = in.refType() != null && !in.refType().isBlank() && in.refId() != null && !in.refId().isBlank();
        return billing.create(new BillingService.NewInvoice(in.contactId(), null, hasRef ? in.refType() : null, hasRef ? in.refId() : null,
                lines, Money.rupeesToPaise(in.discount()), in.notes(), payment, in.sendReceipt()));
    }

    @GetMapping("/invoices/{id}")
    public BillingService.InvoiceDetail detail(@PathVariable UUID id) {
        return billing.detail(id);
    }

    public record PaymentIn(String amount, String mode, String reference, boolean sendReceipt) {
    }

    @PostMapping("/invoices/{id}/payments")
    public Map<String, Long> pay(@PathVariable UUID id, @RequestBody PaymentIn in) {
        return Map.of("amount", billing.recordPayment(id, new BillingService.Payment(Money.rupeesToPaise(in.amount()), in.mode(), in.reference()), in.sendReceipt()));
    }

    public record VoidIn(String reason) {
    }

    @PostMapping("/invoices/{id}/void")
    public BillingService.Invoice voidInvoice(@PathVariable UUID id, @RequestBody VoidIn in) {
        return billing.voidInvoice(id, in.reason());
    }

    @GetMapping("/daybook")
    public BillingService.DayBook dayBook(@RequestParam(required = false) LocalDate date) {
        return billing.dayBook(date == null ? com.arcus.platform.support.Ist.today() : date);
    }
}
