import type { Contact, Document, Organization } from "@prisma/client";
import { formatPhone } from "@/lib/phone";
import { ageFrom, formatDate } from "@/lib/time";
import { instruction, sanitizeRxItems } from "@/verticals/clinic/rx";

interface RxData {
  vitals?: Record<string, string>;
  complaints?: string;
  findings?: string;
  diagnosis?: string;
  advice?: string;
  items?: unknown;
  followUpOn?: string | null;
  doctor?: { name?: string; title?: string | null; qualifications?: string | null; registrationNo?: string | null };
  body?: string;
}

const VITAL_LABELS: Record<string, string> = { bp: "BP", pulse: "Pulse", temp: "Temp", spo2: "SpO₂", weight: "Wt", sugar: "Sugar" };

/** A printable A4/A5 document on the practice's letterhead. */
export function DocumentSheet({ doc, org, contact }: { doc: Document; org: Organization; contact: Contact }) {
  const d = doc.data as RxData;
  const items = sanitizeRxItems(d.items);
  const age = ageFrom(contact.dob);
  const vitals = Object.entries(d.vitals ?? {}).filter(([, v]) => v);
  const lang = contact.preferredLang === "hi" ? "hi" : "en";

  return (
    <article className="mx-auto max-w-[210mm] bg-white p-8 text-[13px] leading-relaxed shadow-sm print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-brand-600 pb-3">
        <div>
          {d.doctor?.name && <div className="text-lg font-bold text-brand-800">{d.doctor.name}</div>}
          {d.doctor?.qualifications && <div className="text-slate-600">{d.doctor.qualifications}</div>}
          {d.doctor?.registrationNo && <div className="text-xs text-slate-500">Reg. No. {d.doctor.registrationNo}</div>}
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

      {doc.type === "PRESCRIPTION" ? (
        <>
          {vitals.length > 0 && (
            <p className="mt-3 text-slate-700">
              {vitals.map(([k, v]) => (
                <span key={k} className="mr-4"><b>{VITAL_LABELS[k] ?? k}:</b> {v}</span>
              ))}
            </p>
          )}
          <div className="mt-2 grid gap-1">
            {d.complaints && <p><b>C/o:</b> {d.complaints}</p>}
            {d.findings && <p><b>O/E:</b> {d.findings}</p>}
            {d.diagnosis && <p><b>Diagnosis:</b> {d.diagnosis}</p>}
          </div>

          <h2 className="mt-4 font-serif text-3xl font-bold text-brand-700">℞</h2>
          {items.length === 0 ? (
            <p className="text-slate-500">No medicines prescribed.</p>
          ) : (
            <ol className="mt-1 space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex gap-3 border-b border-dashed border-slate-200 pb-2">
                  <span className="w-5 text-slate-400">{i + 1}.</span>
                  <div className="flex-1">
                    <div className="font-semibold">
                      {item.name} {item.dose && <span className="font-normal text-slate-600">· {item.dose}</span>}
                    </div>
                    <div className="text-slate-700">
                      <span className="mr-2 font-mono text-xs">{item.frequency}</span>
                      {instruction(item, lang)}
                      {lang === "hi" && <span className="ml-2 text-xs text-slate-500">({instruction(item, "en")})</span>}
                    </div>
                    {item.note && <div className="text-xs text-slate-500">{item.note}</div>}
                  </div>
                </li>
              ))}
            </ol>
          )}
          {d.advice && (
            <p className="mt-4"><b>Advice:</b> {d.advice}</p>
          )}
          {d.followUpOn && (
            <p className="mt-2 font-semibold text-amber-800">
              Follow-up on {formatDate(new Date(d.followUpOn))} {lang === "hi" && "· दोबारा दिखाएँ"}
            </p>
          )}
        </>
      ) : (
        <div className="mt-4 whitespace-pre-wrap">{d.body}</div>
      )}

      <footer className="mt-12 flex items-end justify-between text-xs text-slate-500">
        <span>Generated with Daftar</span>
        <span className="border-t border-slate-400 pt-1 text-slate-700">Signature</span>
      </footer>
    </article>
  );
}
