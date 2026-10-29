import Link from "next/link";
import { createTaskAction, remindTaskAction, remindTomorrowAction, setTaskStatusAction } from "@/platform/actions/tasks";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { Badge, Card, Empty, PageHeader } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { formatPhone } from "@/platform/lib/phone";
import { api } from "@/platform/api/client";
import type { Task } from "@/platform/api/types";
import { addDays, formatDate, formatDateTime, todayIst } from "@/platform/lib/time";

export default async function TasksPage() {
  const ctx = await requireCtx();
  const today = todayIst();
  const tomorrow = addDays(today, 1);
  const tasks = await api.get<Task[]>("/api/tasks");
  const groups = [
    { title: "Overdue", items: tasks.filter((t) => t.dueOn < today), tone: "red" as const },
    { title: "Today", items: tasks.filter((t) => t.dueOn === today), tone: "amber" as const },
    { title: "Tomorrow", items: tasks.filter((t) => t.dueOn === tomorrow), tone: "blue" as const },
    { title: "Next 2 weeks", items: tasks.filter((t) => t.dueOn > tomorrow), tone: "gray" as const },
  ];

  return (
    <>
      <PageHeader
        title="Follow-ups"
        subtitle={`Bring ${ctx.app.terms.contacts.toLowerCase()} back on time. Reminders go out on WhatsApp.`}
        actions={
          <ActionForm action={remindTomorrowAction}>
            <SubmitButton className="btn-primary" pendingText="Sending…">💬 Remind everyone due tomorrow</SubmitButton>
          </ActionForm>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {groups.map((g) => (
            <Card key={g.title} title={`${g.title} (${g.items.length})`}>
              {g.items.length === 0 ? (
                <Empty>Nothing here.</Empty>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {g.items.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                      <div className="text-sm">
                        <div className="font-medium">
                          {t.title}
                          {t.contactId && (
                            <> · <Link href={`/app/contacts/${t.contactId}`} className="link">{t.contactName}</Link></>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          <Badge tone={g.tone}>{formatDate(t.dueOn)}</Badge>
                          {t.contactPhone && ` · ${formatPhone(t.contactPhone)}`}
                          {t.remindedAt && ` · reminded ${formatDateTime(t.remindedAt)}`}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {t.contactId && (
                          <form action={remindTaskAction}>
                            <input type="hidden" name="id" value={t.id} />
                            <button className="btn-secondary btn-sm">💬 Remind</button>
                          </form>
                        )}
                        <form action={setTaskStatusAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value="DONE" />
                          <button className="btn-primary btn-sm">Done</button>
                        </form>
                        <form action={setTaskStatusAction}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="status" value="CANCELLED" />
                          <button className="btn-ghost btn-sm" aria-label="Cancel">✕</button>
                        </form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
        <Card title="Add a to-do">
          <ActionForm action={createTaskAction} className="space-y-3">
            <input name="title" required placeholder="e.g. Call lab for reports" className="input" aria-label="Title" />
            <input name="dueOn" type="date" required defaultValue={tomorrow} className="input" aria-label="Due date" />
            <SubmitButton className="btn-primary w-full">Add</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
