import type { ComponentType } from "react";
import type { AppInfo, Contact, DocumentRecord, PublicOrg } from "@/platform/api/types";
import type { Ctx } from "./auth";

// The UI half of the app/module contract. Each Java app (backend/apps/<id>) has a matching web app
// (src/apps/<id>) that plugs screens into the platform UI through these extension points.

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export type ContactSlot = ComponentType<{ ctx: Ctx; contact: Contact }>;

/** Organization details a printed document shows (signed-in or public). */
export type DocumentOrg = Pick<PublicOrg, "name" | "address" | "phone">;
export type DocumentBody = ComponentType<{ doc: DocumentRecord; org: DocumentOrg; contact: Contact }>;

/** What both modules and apps can plug into the platform UI. */
export interface Extension {
  /** Sidebar entries, shown after "Today". */
  nav?: NavItem[];
  /** Server components rendered at the top of the dashboard. */
  widgets?: ComponentType<{ ctx: Ctx }>[];
  /** Buttons in the header of a contact's profile. */
  contactActions?: ContactSlot;
  /** Extra cards on a contact's profile. */
  contactSections?: ContactSlot;
  /** Extra cards on the Settings page. */
  settingsSections?: ComponentType<{ ctx: Ctx }>[];
}

export interface ModuleUi extends Extension {
  id: string;
}

/** An app's UI, registered in src/registry.ts under the same id as its Java app. */
export interface AppUi extends Extension {
  /** Printable renderers for the app's document types (e.g. "PRESCRIPTION"). */
  documentRenderers?: Record<string, DocumentBody>;
  /** Queue module hook: the page to open when someone in the queue is called in. */
  queue?: { startHref(entryId: string): string; startLabel: string };
}

/** An app as the UI sees it: config from the API plus its registered UI. */
export type AppManifest = AppInfo & AppUi;
