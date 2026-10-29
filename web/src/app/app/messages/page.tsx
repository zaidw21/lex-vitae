import Link from "next/link";
import { retryMessageAction } from "@/platform/actions/messages";
import { MessageBadge } from "@/platform/ui/status";
import { Card, Empty, PageHeader, Stat } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { api, qs } from "@/platform/api/client";
import type { Message } from "@/platform/api/types";
import { formatPhone } from "@/platform/lib/phone";
import { formatDateTime } from "@/platform/lib/time";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ failed?: string }> }) {
  await requireCtx();
  const onlyFailed = (await searchParams).failed === "1";
  const { messages, sentToday, failed: failedCount, provider } = await api.get<{
    messages: Message[];
    sentToday: number;
    failed: number;
    provider: string;
  }>(`/api/messages${qs({ failed: onlyFailed ? "true" : undefined })}`);
  const live = provider !== "log";

  return (
    <>
      <PageHeader title="WhatsApp" subtitle="Every message Arcus sends on your behalf." />
      {!live && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <b>Test mode:</b> messages are recorded here but not delivered. Connect a WhatsApp Business number to send them for real.
        </p>
      )}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Sent today" value={sentToday} />
        <Stat label="Failed" value={failedCount} href="/app/messages?failed=1" />
      </div>
      <div className="mb-3 flex gap-1">
        <Link href="/app/messages" className={`btn-sm ${!onlyFailed ? "btn-primary" : "btn-secondary"}`}>All</Link>
        <Link href="/app/messages?failed=1" className={`btn-sm ${onlyFailed ? "btn-primary" : "btn-secondary"}`}>Failed</Link>
      </div>
      <Card>
        {messages.length === 0 ? (
          <Empty>No messages yet.</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {messages.map((m) => (
              <li key={m.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-slate-500">
                    {formatDateTime(m.createdAt)} · {m.contactId ? <Link href={`/app/contacts/${m.contactId}`} className="link">{m.contactName}</Link> : formatPhone(m.to)} ·{" "}
                    {m.template.replace(/_/g, " ").toLowerCase()}
                  </div>
                  <p className="mt-1 max-w-2xl rounded-lg bg-emerald-50 px-3 py-2 text-sm">{m.body}</p>
                  {m.error && <p className="mt-1 text-xs text-red-700">{m.error}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <MessageBadge status={m.status} />
                  {m.status === "FAILED" && m.contactOptedIn && (
                    <form action={retryMessageAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="btn-secondary btn-sm">Retry</button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
