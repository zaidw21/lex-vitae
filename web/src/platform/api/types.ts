// Types for the Java API's JSON (records in backend/platform and backend/apps). Dates are ISO strings:
// instants like "2026-10-29T03:41:33Z", calendar days like "2026-10-29". Money is integer paise.

export type Role = "OWNER" | "ADMIN" | "PRACTITIONER" | "STAFF";

export interface Terms {
  practice: string;
  contact: string;
  contacts: string;
  practitioner: string;
  encounter: string;
  encounters: string;
}

export interface FieldDef {
  key: string;
  label: string;
  type: "text" | "textarea" | "select";
  options?: string[] | null;
  placeholder?: string | null;
}

export interface AppInfo {
  id: string;
  name: string;
  tagline: string;
  terms: Terms;
  practitionerPrefix: string;
  contactFields: FieldDef[];
  modules: string[];
  optionalModules: string[];
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  app: string;
  modules: string[];
  city: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  qualifications: string | null;
  registrationNo: string | null;
}

export interface SessionInfo {
  principal: { userId: string; userName: string; orgId: string; membershipId: string; role: Role; app: string; modules: string[] };
  org: Org;
  me: Member;
  app: AppInfo;
  modules: { id: string; name: string; description: string; enabled: boolean }[];
  memberships: { orgId: string; orgName: string; app: string }[];
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  gender: string | null;
  dob: string | null;
  age: number | null;
  address: string | null;
  preferredLang: string;
  whatsappOptIn: boolean;
  consentAt: string | null;
  fields: Record<string, string>;
  createdAt: string;
}

export interface Encounter {
  id: string;
  contactId: string;
  providerId: string | null;
  queueEntryId: string | null;
  refType: string | null;
  refId: string | null;
  kind: string;
  occurredAt: string;
  summary: string | null;
  data: Record<string, unknown>;
  followUpOn: string | null;
}

export interface DocumentRecord {
  id: string;
  contactId: string;
  encounterId: string | null;
  refType: string | null;
  refId: string | null;
  type: string;
  title: string;
  data: Record<string, unknown>;
  publicCode: string;
  createdAt: string;
}

export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "VOID";

export interface Invoice {
  id: string;
  number: number;
  contactId: string;
  contactName: string;
  encounterId: string | null;
  refType: string | null;
  refId: string | null;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  notes: string | null;
  voidReason: string | null;
  publicCode: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  mode: string;
  reference: string | null;
  receivedBy: string | null;
  receivedByName: string | null;
  receivedAt: string;
}

export interface InvoiceDetail {
  invoice: Invoice;
  contact: Contact;
  items: { description: string; qty: number; unitPrice: number; amount: number }[];
  payments: Payment[];
  history: { action: string; actorName: string; data: Record<string, unknown>; createdAt: string }[];
}

export type TaskStatus = "OPEN" | "DONE" | "CANCELLED";

export interface Task {
  id: string;
  contactId: string | null;
  contactName: string | null;
  contactPhone: string | null;
  refType: string | null;
  refId: string | null;
  kind: string;
  title: string;
  dueOn: string;
  status: TaskStatus;
  remindedAt: string | null;
}

export type MessageStatus = "QUEUED" | "SENT" | "FAILED";

export interface Message {
  id: string;
  contactId: string | null;
  contactName: string | null;
  contactOptedIn: boolean;
  to: string;
  template: string;
  body: string;
  status: MessageStatus;
  provider: string;
  error: string | null;
  createdAt: string;
}

export interface CatalogItem {
  id: string;
  kind: string;
  name: string;
  price: number;
  data: Record<string, unknown>;
}

export type QueueStatus = "WAITING" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "CANCELLED";

export interface QueueEntry {
  id: string;
  date: string;
  tokenNumber: number;
  contactId: string;
  providerId: string | null;
  appointmentId: string | null;
  status: QueueStatus;
  publicCode: string;
  checkedInAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export type AppointmentStatus = "BOOKED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

export interface Appointment {
  id: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  providerId: string | null;
  providerName: string | null;
  startsAt: string;
  durationMin: number;
  status: AppointmentStatus;
  source: string;
  notes: string | null;
}

export interface PublicOrg {
  id: string;
  name: string;
  slug: string;
  app: string;
  address: string | null;
  phone: string | null;
  gstin: string | null;
}
