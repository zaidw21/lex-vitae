import type { Contact, QueueEntry } from "@/platform/api/types";

export interface Board {
  date: string;
  entries: { entry: QueueEntry; contact: Contact; hasEncounter: boolean }[];
  avgMinutes: number;
}

export interface Summary {
  byStatus: Partial<Record<QueueEntry["status"], number>>;
  checkInsByHour: number[];
}

export interface TokenStatus {
  orgName: string;
  tokenNumber: number;
  status: QueueEntry["status"];
  isToday: boolean;
  ahead: number;
  avgMinutes: number;
  nowServing: number | null;
  lang: string;
}

export interface Display {
  orgName: string;
  serving: number[];
  waiting: number[];
}
