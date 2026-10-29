package com.arcus.platform.spi;

import java.util.Map;

/** An optional platform feature (queue, appointments) that apps switch on. */
public interface ModuleDefinition {

    String id();

    String name();

    String description();

    default Map<String, Template> messages() {
        return Map.of();
    }
}
