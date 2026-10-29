import type { Encounter, Invoice, Task } from "@/platform/api/types";

/** backend: com.arcus.apps.legal.MatterService.Matter */
export interface Matter {
  id: string;
  contactId: string;
  clientName: string;
  clientPhone: string;
  title: string;
  caseNumber: string | null;
  cnr: string | null;
  court: string | null;
  caseType: string | null;
  oppositeParty: string | null;
  stage: string | null;
  status: "OPEN" | "CLOSED";
  nextHearingOn: string | null;
  createdAt: string;
}

export interface MatterView {
  matter: Matter;
  hearings: Encounter[];
  invoices: Invoice[];
  tasks: Task[];
}

export interface Diary {
  date: string;
  listed: Matter[];
  needsDate: Matter[];
  week: Record<string, number>;
}

export interface Options {
  caseTypes: string[];
  stages: string[];
}
