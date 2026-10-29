import type { Contact, DocumentRecord } from "@/platform/api/types";
import { formatDate } from "@/platform/lib/time";
import { instruction, sanitizeRxItems } from "../rx";

interface RxData {
  vitals?: Record<string, string>;
  complaints?: string;
  findings?: string;
  diagnosis?: string;
  advice?: string;
  items?: unknown;
  followUpOn?: string | null;
}

const VITAL_LABELS: Record<string, string> = { bp: "BP", pulse: "Pulse", temp: "Temp", spo2: "SpO₂", weight: "Wt", sugar: "Sugar" };

/** Body of a printed prescription (the platform supplies the letterhead around it). */
export function PrescriptionSheet({ doc, contact }: { doc: DocumentRecord; contact: Contact }) {
  const d = doc.data as RxData;
  const items = sanitizeRxItems(d.items);
  const vitals = Object.entries(d.vitals ?? {}).filter(([, v]) => v);
  const lang = contact.preferredLang === "hi" ? "hi" : "en";

  return (
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
  );
}
