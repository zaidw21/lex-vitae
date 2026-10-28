import { notFound } from "next/navigation";
import { updateContactAction } from "@/platform/actions/contacts";
import { ContactForm } from "@/platform/ui/contact-form";
import { Card, PageHeader } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { findContact } from "@/platform/services/contacts";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const contact = await findContact(ctx, (await params).id);
  if (!contact) notFound();
  return (
    <>
      <PageHeader title={`Edit ${contact.name}`} />
      <Card className="max-w-3xl">
        <ContactForm pack={ctx.app} action={updateContactAction} contact={contact} submitLabel="Save changes" />
      </Card>
    </>
  );
}
