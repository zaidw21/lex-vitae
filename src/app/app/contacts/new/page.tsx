import { createContactAction } from "@/platform/actions/contacts";
import { ContactForm } from "@/platform/ui/contact-form";
import { Card, PageHeader } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";

export default async function NewContactPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const ctx = await requireCtx();
  const { next } = await searchParams;
  return (
    <>
      <PageHeader title={`New ${ctx.app.terms.contact.toLowerCase()}`} />
      <Card className="max-w-3xl">
        <ContactForm pack={ctx.app} action={createContactAction} next={next} submitLabel={`Save ${ctx.app.terms.contact.toLowerCase()}`} />
      </Card>
    </>
  );
}
