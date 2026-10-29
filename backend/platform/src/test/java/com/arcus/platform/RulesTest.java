package com.arcus.platform;

import com.arcus.platform.billing.BillingService;
import com.arcus.platform.messaging.PlatformTemplates;
import com.arcus.platform.modules.queue.QueueService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class RulesTest {

    @Test
    void invoiceTotalsClampTheDiscount() {
        var lines = List.of(new BillingService.Line("Consultation", 1, 40000), new BillingService.Line("ECG", 2, 30000));
        assertThat(BillingService.totals(lines, 10000)).isEqualTo(new BillingService.Totals(100000, 10000, 90000));
        assertThat(BillingService.totals(lines, 500000)).isEqualTo(new BillingService.Totals(100000, 100000, 0));
        assertThat(BillingService.totals(lines, -5)).isEqualTo(new BillingService.Totals(100000, 0, 100000));
    }

    @Test
    void invoiceStatusFollowsPayments() {
        assertThat(BillingService.statusFor(1000, 0)).isEqualTo("UNPAID");
        assertThat(BillingService.statusFor(1000, 500)).isEqualTo("PARTIAL");
        assertThat(BillingService.statusFor(1000, 1000)).isEqualTo("PAID");
        assertThat(BillingService.statusFor(0, 0)).isEqualTo("PAID");
    }

    @Test
    void queueTransitions() {
        assertThat(QueueService.canTransition("WAITING", "IN_PROGRESS")).isTrue();
        assertThat(QueueService.canTransition("IN_PROGRESS", "DONE")).isTrue();
        assertThat(QueueService.canTransition("SKIPPED", "WAITING")).isTrue();
        assertThat(QueueService.canTransition("DONE", "WAITING")).isFalse();
        assertThat(QueueService.canTransition("WAITING", "DONE")).isFalse();
    }

    @Test
    void templatesFillKnownAndBlankUnknownPlaceholders() {
        assertThat(PlatformTemplates.render("Hi {{name}}{{missing}} ({{n}})", Map.of("name", "Asha", "n", 3))).isEqualTo("Hi Asha (3)");
        assertThat(PlatformTemplates.render("{{x}}", Map.of("x", "$1 \\ back"))).isEqualTo("$1 \\ back");
    }
}
