import { createContactAction } from "@/actions/contacts";
import { ContactForm } from "@/components/contact-form";
import { Card, PageHeader } from "@/components/ui";
import { requireCtx } from "@/core/auth";

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const ctx = await requireCtx();
  const { next } = await searchParams;
  return (
    <>
      <PageHeader title={`New ${ctx.pack.terms.contact.toLowerCase()}`} />
      <Card className="max-w-3xl">
        <ContactForm pack={ctx.pack} action={createContactAction} next={next} submitLabel={`Save ${ctx.pack.terms.contact.toLowerCase()}`} />
      </Card>
    </>
  );
}
