import type { ComponentType } from "react";
import type { Contact, Document, Organization } from "@prisma/client";
import { formatPhone } from "@/platform/lib/phone";
import { ageFrom, formatDate } from "@/platform/lib/time";

interface DocData {
  /** Snapshot of the practitioner who issued the document, printed in the letterhead. */
  issuedBy?: { name?: string; title?: string | null; qualifications?: string | null; registrationNo?: string | null };
  body?: string;
}

export type DocumentBody = ComponentType<{ doc: Document; org: Organization; contact: Contact }>;

/**
 * A printable document on the practice's letterhead. Apps supply the body for their own document
 * types (e.g. prescriptions) via `documentRenderers`; otherwise the plain-text body is printed.
 */
export function DocumentSheet({ doc, org, contact, Body }: { doc: Document; org: Organization; contact: Contact; Body?: DocumentBody }) {
  const d = doc.data as DocData & { doctor?: DocData["issuedBy"] };
  const issuer = d.issuedBy ?? d.doctor; // `doctor` in documents saved before v0.2
  const age = ageFrom(contact.dob);

  return (
    <article className="mx-auto max-w-[210mm] bg-white p-8 text-[13px] leading-relaxed shadow-sm print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-600 pb-3">
        <div>
          {issuer?.name && <div className="text-lg font-bold text-brand-800">{issuer.name}</div>}
          {issuer?.qualifications && <div className="text-slate-600">{issuer.qualifications}</div>}
          {issuer?.registrationNo && <div className="text-xs text-slate-500">Reg. No. {issuer.registrationNo}</div>}
        </div>
        <div className="text-right">
          <div className="font-semibold">{org.name}</div>
          {org.address && <div className="text-xs text-slate-600">{org.address}</div>}
          {org.phone && <div className="text-xs text-slate-600">📞 {formatPhone(org.phone)}</div>}
        </div>
      </header>

      <section className="mt-3 flex flex-wrap justify-between gap-2 border-b border-slate-200 pb-2">
        <div>
          <b>{contact.name}</b>
          {[age !== null ? `${age} yrs` : null, contact.gender].filter(Boolean).length > 0 && (
            <span className="text-slate-600"> · {[age !== null ? `${age} yrs` : null, contact.gender].filter(Boolean).join(" / ")}</span>
          )}
          <span className="text-slate-600"> · {formatPhone(contact.phone)}</span>
        </div>
        <div className="text-slate-600">Date: {formatDate(doc.createdAt)}</div>
      </section>

      {Body ? <Body doc={doc} org={org} contact={contact} /> : <div className="mt-4 whitespace-pre-wrap">{d.body}</div>}

      <footer className="mt-12 flex items-end justify-between text-xs text-slate-500">
        <span>Generated with Arcus</span>
        <span className="border-t border-slate-400 pt-1 text-slate-700">Signature</span>
      </footer>
    </article>
  );
}
