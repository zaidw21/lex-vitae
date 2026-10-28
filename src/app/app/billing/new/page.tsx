import { createInvoiceAction } from "@/platform/actions/billing";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { LineEditor } from "@/platform/ui/line-editor";
import { Card, PageHeader } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { findContact } from "@/platform/services/contacts";
import { db } from "@/platform/lib/db";
import { formatPhone } from "@/platform/lib/phone";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ contact?: string; matter?: string }> }) {
  const ctx = await requireCtx();
  const sp = await searchParams;
  const [contact, services, matter] = await Promise.all([
    sp.contact ? findContact(ctx, sp.contact) : null,
    db.catalogItem.findMany({ where: { orgId: ctx.org.id, kind: "SERVICE", active: true }, orderBy: { name: "asc" } }),
    sp.matter ? db.matter.findFirst({ where: { id: sp.matter, orgId: ctx.org.id } }) : null,
  ]);
  const t = ctx.app.terms;

  return (
    <>
      <PageHeader title="New bill" />
      <Card className="max-w-3xl">
        <ActionForm action={createInvoiceAction} className="space-y-5">
          {contact ? (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <input type="hidden" name="contactId" value={contact.id} />
              {t.contact}: <b>{contact.name}</b> · {formatPhone(contact.phone)}
              {matter && (
                <>
                  <input type="hidden" name="matterId" value={matter.id} /> · Matter: <b>{matter.title}</b>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="name" required placeholder={`${t.contact} name`} className="input" aria-label="Name" />
              <input name="phone" type="tel" required placeholder="WhatsApp mobile" className="input" aria-label="Mobile" />
              <input type="hidden" name="whatsappOptIn" value="on" />
              <input type="hidden" name="preferredLang" value="hi" />
            </div>
          )}
          <LineEditor services={services.map((s) => ({ name: s.name, price: s.price }))} initial={[]} />
          <div>
            <label className="label" htmlFor="notes">Notes (required for discounts)</label>
            <input id="notes" name="notes" className="input" placeholder="e.g. Senior citizen discount" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="sendReceipt" defaultChecked className="accent-brand-600" /> Send receipt on WhatsApp
          </label>
          <SubmitButton>Save bill</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
