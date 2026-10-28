import Link from "next/link";
import type { ContactSlot } from "@/platform/kernel/types";

export const BookAppointmentLink: ContactSlot = ({ contact }) => (
  <Link href={`/app/appointments?contact=${contact.id}`} className="btn-secondary">Book appointment</Link>
);
