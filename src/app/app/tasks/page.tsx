import Link from "next/link";
import { createTaskAction, remindTaskAction, remindTomorrowAction, setTaskStatusAction } from "@/platform/actions/tasks";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { Badge, Card, Empty, PageHeader } from "@/platform/ui/ui";
import { requireCtx } from "@/platform/kernel/auth";
import { formatPhone } from "@/platform/lib/phone";
import { addDays, formatDate, formatDateTime, istDate, toDateInput } from "@/platform/lib/time";

export default async function TasksPage() {
  const ctx = await requireCtx();
  const today = istDate();
  const tasks = await ctx.db.task.findMany({
    where: { status: "OPEN", dueOn: { lte: addDays(today, 14) } },
    include: { contact: true },
    orderBy: { dueOn: "asc" },
    take: 200,
  });
  const groups = [
    { title: "Overdue", items: tasks.filter((t) => t.dueOn < today), tone: "red" as const },
    { title: "Today", items: tasks.filter((t) => t.dueOn.getTime() === today.getTime()), tone: "amber" as const },
    { title: "Tomorrow", items: tasks.filter((t) => t.dueOn.getTime() === addDays(today, 1).getTime()), tone: "blue" as const },
    { title: "Next 2 weeks", items: tasks.filter((t) => t.dueOn > addDays(today, 1)), tone: "gray" as const },
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
                          {t.contact && (
                            <> · <Link href={`/app/contacts/${t.contact.id}`} className="link">{t.contact.name}</Link></>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">
                          <Badge tone={g.tone}>{formatDate(t.dueOn)}</Badge>
                          {t.contact && ` · ${formatPhone(t.contact.phone)}`}
                          {t.remindedAt && ` · reminded ${formatDateTime(t.remindedAt)}`}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {t.contact && (
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
            <input name="dueOn" type="date" required defaultValue={toDateInput(addDays(today, 1))} className="input" aria-label="Due date" />
            <SubmitButton className="btn-primary w-full">Add</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
