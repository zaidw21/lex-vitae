import type { Vertical } from "@prisma/client";

/** Platform modules. A vertical pack picks which ones it switches on. */
export type ModuleKey =
  | "dashboard"
  | "queue"
  | "appointments"
  | "contacts"
  | "matters"
  | "hearings"
  | "billing"
  | "tasks"
  | "messages"
  | "settings";

/** Messages the platform knows how to send. Packs supply wording in English and Hindi. */
export type MessageKey =
  | "TOKEN_ISSUED"
  | "TURN_NEAR"
  | "DELAY_NOTICE"
  | "APPOINTMENT_BOOKED"
  | "FOLLOW_UP_REMINDER"
  | "DOCUMENT_SHARED"
  | "RECEIPT"
  | "HEARING_UPDATE";

export type Lang = "en" | "hi";
export type MessageTemplates = Partial<Record<MessageKey, Record<Lang, string>>>;

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

export interface VerticalPack {
  id: Vertical;
  name: string;
  tagline: string;
  terms: Terms;
  practitionerPrefix: string;
  modules: ModuleKey[];
  contactFields: FieldDef[];
  defaultServices: { name: string; price: number }[]; // price in rupees
  messages: MessageTemplates;
  /** Default settings stored on a new organization. */
  defaultSettings: Record<string, unknown>;
}
