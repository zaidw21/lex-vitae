import Link from "next/link";
import type { ContactSlot } from "@/platform/kernel/types";

export const StartConsultationLink: ContactSlot = ({ ctx, contact }) => (
  <Link href={`/app/consult?contact=${contact.id}`} className="btn-secondary">Start {ctx.app.terms.encounter.toLowerCase()}</Link>
);
