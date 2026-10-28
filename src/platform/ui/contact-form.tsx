import type { Contact } from "@prisma/client";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import type { FormState } from "@/platform/lib/form-state";
import { toDateInput } from "@/platform/lib/time";
import type { AppManifest } from "@/platform/kernel/types";

export function ContactForm({
  pack,
  action,
  contact,
  next,
  submitLabel,
}: {
  pack: AppManifest;
  action: (s: FormState, f: FormData) => Promise<FormState>;
  contact?: Contact;
  next?: string;
  submitLabel: string;
}) {
  const fields = (contact?.fields ?? {}) as Record<string, string>;
  return (
    <ActionForm action={action} className="space-y-5">
      {contact && <input type="hidden" name="id" value={contact.id} />}
      {next && <input type="hidden" name="next" value={next} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Full name *</label>
          <input id="name" name="name" required defaultValue={contact?.name} className="input" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="phone">WhatsApp mobile *</label>
          <input id="phone" name="phone" type="tel" required defaultValue={contact?.phone.replace(/^\+91/, "")} className="input" placeholder="98xxxxxxxx" />
        </div>
        <div>
          <label className="label" htmlFor="gender">Gender</label>
          <select id="gender" name="gender" defaultValue={contact?.gender ?? ""} className="input">
            <option value="">—</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
            <option value="O">Other</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label" htmlFor="age">Age</label>
            <input id="age" name="age" type="number" min={0} max={119} className="input" placeholder="yrs" />
          </div>
          <div>
            <label className="label" htmlFor="dob">or DOB</label>
            <input id="dob" name="dob" type="date" defaultValue={contact?.dob ? toDateInput(contact.dob) : ""} className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="preferredLang">Message language</label>
          <select id="preferredLang" name="preferredLang" defaultValue={contact?.preferredLang ?? "hi"} className="input">
            <option value="hi">हिन्दी (Hindi)</option>
            <option value="en">English</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={contact?.email ?? ""} className="input" />
        </div>
        {pack.contactFields.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={`f_${f.key}`}>{f.label}</label>
            {f.type === "select" ? (
              <select id={`f_${f.key}`} name={`f_${f.key}`} defaultValue={fields[f.key] ?? ""} className="input">
                {f.options?.map((o) => (
                  <option key={o} value={o}>{o || "—"}</option>
                ))}
              </select>
            ) : (
              <input id={`f_${f.key}`} name={`f_${f.key}`} defaultValue={fields[f.key] ?? ""} placeholder={f.placeholder} className="input" />
            )}
          </div>
        ))}
        <div className="sm:col-span-2">
          <label className="label" htmlFor="address">Address</label>
          <input id="address" name="address" defaultValue={contact?.address ?? ""} className="input" />
        </div>
      </div>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" name="whatsappOptIn" defaultChecked={contact ? contact.whatsappOptIn : true} className="mt-0.5 accent-brand-600" />
        <span>
          {pack.terms.contact} agrees to receive updates on WhatsApp and to their details being stored for treatment/services
          <span className="block text-xs text-slate-500">Consent is recorded with a timestamp (DPDP Act, 2023).</span>
        </span>
      </label>
      <SubmitButton>{submitLabel}</SubmitButton>
    </ActionForm>
  );
}
