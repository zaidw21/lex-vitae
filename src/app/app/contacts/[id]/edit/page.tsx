import { notFound } from "next/navigation";
import { updateContactAction } from "@/actions/contacts";
import { ContactForm } from "@/components/contact-form";
import { Card, PageHeader } from "@/components/ui";
import { requireCtx } from "@/core/auth";
import { findContact } from "@/core/contacts";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCtx();
  const contact = await findContact(ctx, (await params).id);
  if (!contact) notFound();
  return (
    <>
      <PageHeader title={`Edit ${contact.name}`} />
      <Card className="max-w-3xl">
        <ContactForm pack={ctx.pack} action={updateContactAction} contact={contact} submitLabel="Save changes" />
      </Card>
    </>
  );
}
