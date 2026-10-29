import type { AppointmentStatus, InvoiceStatus, MessageStatus, QueueStatus, TaskStatus } from "@/platform/api/types";
import { Badge, type Tone } from "./ui";

const INVOICE: Record<InvoiceStatus, [Tone, string]> = {
  PAID: ["green", "Paid"],
  PARTIAL: ["amber", "Partly paid"],
  UNPAID: ["red", "Unpaid"],
  VOID: ["gray", "Void"],
};
const QUEUE: Record<QueueStatus, [Tone, string]> = {
  WAITING: ["amber", "Waiting"],
  IN_PROGRESS: ["blue", "In progress"],
  DONE: ["green", "Done"],
  SKIPPED: ["violet", "Skipped"],
  CANCELLED: ["gray", "Cancelled"],
};
const APPT: Record<AppointmentStatus, [Tone, string]> = {
  BOOKED: ["blue", "Booked"],
  CHECKED_IN: ["amber", "Checked in"],
  COMPLETED: ["green", "Completed"],
  CANCELLED: ["gray", "Cancelled"],
  NO_SHOW: ["red", "No-show"],
};
const MESSAGE: Record<MessageStatus, [Tone, string]> = {
  QUEUED: ["gray", "Queued"],
  SENT: ["green", "Sent"],
  FAILED: ["red", "Failed"],
};
const TASK: Record<TaskStatus, [Tone, string]> = {
  OPEN: ["amber", "Open"],
  DONE: ["green", "Done"],
  CANCELLED: ["gray", "Cancelled"],
};

function make<T extends string>(map: Record<T, [Tone, string]>) {
  return function StatusBadge({ status }: { status: T }) {
    const [tone, label] = map[status];
    return <Badge tone={tone}>{label}</Badge>;
  };
}

export const InvoiceBadge = make(INVOICE);
export const QueueBadge = make(QUEUE);
export const AppointmentBadge = make(APPT);
export const MessageBadge = make(MESSAGE);
export const TaskBadge = make(TASK);
