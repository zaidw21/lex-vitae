import { createMatterAction } from "../actions";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { Card, PageHeader } from "@/platform/ui/ui";
import { api } from "@/platform/api/client";
import type { Contact } from "@/platform/api/types";
import { load, requireCtx } from "@/platform/kernel/auth";
import { requireApp } from "@/platform/kernel/modules";
import { formatPhone } from "@/platform/lib/phone";
import type { Options } from "../types";

export default async function NewMatterPage({ searchParams }: { searchParams: Promise<{ contact?: string }> }) {
  const ctx = await requireCtx();
  requireApp(ctx, "legal");
  const { contact: contactId } = await searchParams;
  const [options, contact] = await Promise.all([
    load(api.get<Options>("/api/apps/legal/options")),
    contactId ? api.get<{ contact: Contact }>(`/api/contacts/${encodeURIComponent(contactId)}`).then((p) => p.contact).catch(() => null) : null,
  ]);

  return (
    <>
      <PageHeader title="New matter" />
      <Card className="max-w-3xl">
        <ActionForm action={createMatterAction} className="space-y-4">
          {contact ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <input type="hidden" name="contactId" value={contact.id} />
              Client: <b>{contact.name}</b> · {formatPhone(contact.phone)}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <input name="name" required placeholder="Client name" className="input" aria-label="Client name" />
              <input name="phone" type="tel" required placeholder="Client WhatsApp" className="input" aria-label="Client mobile" />
              <select name="preferredLang" className="input" defaultValue="hi" aria-label="Language">
                <option value="hi">Updates in Hindi</option>
                <option value="en">Updates in English</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-3">
                <input type="checkbox" name="whatsappOptIn" defaultChecked className="accent-brand-600" /> Client agrees to case updates on WhatsApp
              </label>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="title">Title *</label>
              <input id="title" name="title" required className="input" placeholder="Ramesh Gupta vs. Suresh Jain" />
            </div>
            <div>
              <label className="label" htmlFor="caseType">Case type</label>
              <select id="caseType" name="caseType" className="input">
                {options.caseTypes.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="court">Court</label>
              <input id="court" name="court" className="input" placeholder="District Court, Indore" />
            </div>
            <div>
              <label className="label" htmlFor="caseNumber">Case number</label>
              <input id="caseNumber" name="caseNumber" className="input" placeholder="CS/123/2026" />
            </div>
            <div>
              <label className="label" htmlFor="cnr">CNR (eCourts)</label>
              <input id="cnr" name="cnr" className="input font-mono" placeholder="MPIN010012342026" />
            </div>
            <div>
              <label className="label" htmlFor="oppositeParty">Opposite party</label>
              <input id="oppositeParty" name="oppositeParty" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="stage">Stage</label>
              <select id="stage" name="stage" className="input">
                {options.stages.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="nextHearingOn">Next date of hearing</label>
              <input id="nextHearingOn" name="nextHearingOn" type="date" className="input" />
            </div>
          </div>
          <SubmitButton>Create matter</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
