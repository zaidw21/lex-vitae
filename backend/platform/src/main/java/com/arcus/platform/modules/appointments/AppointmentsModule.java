package com.arcus.platform.modules.appointments;

import com.arcus.platform.spi.ModuleDefinition;
import org.springframework.stereotype.Component;

@Component
public class AppointmentsModule implements ModuleDefinition {

    public static final String ID = "appointments";

    @Override
    public String id() {
        return ID;
    }

    @Override
    public String name() {
        return "Appointments";
    }

    @Override
    public String description() {
        return "Book, confirm on WhatsApp, check in, track no-shows.";
    }
}
