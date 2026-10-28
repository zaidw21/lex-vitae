import type { ComponentType } from "react";
import type { Contact, Document, Organization, Prisma } from "@prisma/client";
import type { Ctx } from "./auth";

// The contract between the platform and what runs on it.
//  - Modules are optional platform features (queue, appointments) an app can switch on.
//  - Apps (clinic, legal, ...) are domain products assembled from the platform + modules + their own code.
// Both contribute through the same extension points; the platform renders whatever is registered.

export type Lang = "en" | "hi";
/** WhatsApp/SMS message templates by key, in English and Hindi. `{{var}}` placeholders. */
export type MessageTemplates = Record<string, Record<Lang, string>>;

export type ModuleId = "queue" | "appointments";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[];
  placeholder?: string;
}

export interface Terms {
  practice: string;
  contact: string;
  contacts: string;
  practitioner: string;
  encounter: string;
  encounters: string;
}

export type ContactSlot = ComponentType<{ ctx: Ctx; contact: Contact }>;

/** What both modules and apps can plug into the platform. */
export interface Extension {
  /** Sidebar entries, shown after "Today". */
  nav?: NavItem[];
  /** Message templates; apps override modules, modules override platform defaults. */
  messages?: MessageTemplates;
  /** Server components rendered at the top of the dashboard. */
  widgets?: ComponentType<{ ctx: Ctx }>[];
  /** Buttons in the header of a contact's profile. */
  contactActions?: ContactSlot;
  /** Extra cards on a contact's profile. */
  contactSections?: ContactSlot;
  /** Extra cards on the Settings page. */
  settingsSections?: ComponentType<{ ctx: Ctx }>[];
}

export interface ModuleManifest extends Extension {
  id: ModuleId;
  name: string;
  description: string;
}

/**
 * An app's definition without any UI: terminology, defaults, templates, provisioning.
 * Kept free of React so scripts (seeding, migrations, jobs) can use it.
 */
export interface AppConfig {
  id: string;
  /** Product name shown to customers, e.g. "Arcus Clinic". */
  name: string;
  tagline: string;
  terms: Terms;
  practitionerPrefix: string;
  /** Modules switched on for a new organization. */
  modules: ModuleId[];
  /** Further modules the owner may switch on in Settings. */
  optionalModules?: ModuleId[];
  contactFields: FieldDef[];
  /** Starter billable services (price in rupees). */
  defaultServices: { name: string; price: number }[];
  defaultSettings: Record<string, unknown>;
  /** Message templates; apps override modules, modules override platform defaults. */
  messages?: MessageTemplates;
  /** Extra setup for a new organization (e.g. starter catalog), inside the provisioning transaction. */
  provision?: (tx: Prisma.TransactionClient, orgId: string) => Promise<void>;
}

/** An app as the platform runs it: its config plus the UI it plugs into the platform. */
export interface AppManifest extends AppConfig, Extension {
  /** Printable renderers for app-specific document types (e.g. "PRESCRIPTION"). */
  documentRenderers?: Record<string, ComponentType<{ doc: Document; org: Organization; contact: Contact }>>;
  /** Queue module hook: the page to open when someone in the queue is called in (e.g. a consultation). */
  queue?: { startHref(entryId: string): string; startLabel: string };
}
