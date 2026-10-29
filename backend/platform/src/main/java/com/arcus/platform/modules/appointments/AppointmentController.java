package com.arcus.platform.modules.appointments;

import com.arcus.platform.contacts.ContactService;
import com.arcus.platform.kernel.AppRegistry;
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
@RequestMapping("/api/modules/appointments")
public class AppointmentController {

    private final AppointmentService appointments;
    private final ContactService contacts;

    public AppointmentController(AppointmentService appointments, ContactService contacts) {
        this.appointments = appointments;
        this.contacts = contacts;
    }

    @GetMapping
    public List<AppointmentService.Appointment> day(@RequestParam(required = false) LocalDate date) {
        return appointments.forDay(date == null ? com.arcus.platform.support.Ist.today() : date);
    }

    /** Book for an existing contact (contactId) or a new one (contact = name + mobile, matched or registered). */
    public record Booking(UUID contactId, ContactService.ContactInput contact, LocalDate date, String time, UUID providerId,
                          int durationMin, String source, String notes) {
    }

    @PostMapping
    public Map<String, UUID> book(@RequestBody Booking in) {
        AppRegistry.requireModule(AppointmentsModule.ID);
        UUID contactId = in.contactId() != null ? in.contactId() : contacts.findOrCreate(in.contact()).id();
        return Map.of("id", appointments.book(new AppointmentService.NewAppointment(contactId, in.date(), in.time(), in.providerId(),
                in.durationMin() == 0 ? 15 : in.durationMin(), in.source(), in.notes())));
    }

    public record Status(String status) {
    }

    @PostMapping("/{id}/status")
    public Map<String, Boolean> status(@PathVariable UUID id, @RequestBody Status body) {
        appointments.setStatus(id, body.status());
        return Map.of("ok", true);
    }
}
