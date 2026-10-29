package com.arcus.platform.spi;

import org.springframework.jdbc.core.simple.JdbcClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * A domain app (Arcus Clinic, Arcus Legal, ...) running on the platform. An app is a Maven module that
 * depends on the platform, registers one Spring bean implementing this interface, and ships its own REST
 * controllers and database migrations ({@code db/apps/<id>}). The platform discovers apps through Spring;
 * it never references them, and adding an app never changes platform code.
 */
public interface AppDefinition {

    /** Stable id stored on each organization, e.g. "clinic". */
    String id();

    /** Product name shown to customers, e.g. "Arcus Clinic". */
    String name();

    String tagline();

    Terms terms();

    String practitionerPrefix();

    /** Platform modules switched on for a new organization. */
    List<String> modules();

    /** Further modules an owner may switch on in Settings. */
    default List<String> optionalModules() {
        return List.of();
    }

    /** App-specific contact fields (stored in contacts.fields). */
    default List<FieldDef> contactFields() {
        return List.of();
    }

    /** Starter billable services for a new organization. */
    default List<ServiceDefault> defaultServices() {
        return List.of();
    }

    /** Starter values for organizations.settings. */
    default Map<String, Object> defaultSettings() {
        return Map.of();
    }

    /** Message templates; override module and platform wording by key. */
    default Map<String, Template> messages() {
        return Map.of();
    }

    /** Extra setup for a new organization, inside the provisioning transaction (scoped to that org). */
    default void provision(UUID orgId, JdbcClient db) {
    }
}
