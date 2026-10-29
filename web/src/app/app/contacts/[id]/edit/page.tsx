import { updateContactAction } from "@/platform/actions/contacts";
import { api } from "@/platform/api/client";
import type { Contact } from "@/platform/api/types";
import { load, requireCtx } from "@/platform/kernel/auth";
import { ContactForm } from "@/platform/ui/contact-form";
import { Card, PageHeader } from "@/platform/ui/ui";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const { contact } = await load(api.get<{ contact: Contact }>(`/api/contacts/${encodeURIComponent((await params).id)}`));
  return (
    <>
      <PageHeader title={`Edit ${contact.name}`} />
      <Card className="max-w-3xl">
        <ContactForm app={ctx.app} action={updateContactAction} contact={contact} submitLabel="Save changes" />
      </Card>
    </>
  );
}
