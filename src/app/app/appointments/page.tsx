import Link from "next/link";
import { appointmentStatusAction, bookAppointmentAction } from "@/actions/appointments";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { AppointmentBadge } from "@/components/status";
import { Card, Empty, PageHeader } from "@/components/ui";
import { requireCtx } from "@/core/auth";
import { findContact } from "@/core/contacts";
import { requireModule } from "@/core/modules";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { addDays, formatDate, formatTime, istDate, istDayRange, parseDateInput, toDateInput } from "@/lib/time";
import { hasModule } from "@/verticals";

function StatusButton({ id, status, label, className = "btn-secondary btn-sm" }: { id: string; status: string; label: string; className?: string }) {
  return (
    <form action={appointmentStatusAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="status" value={status} />
      <button className={className}>{label}</button>
    </form>
  );
}

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ date?: string; contact?: string }> }) {
  const ctx = await requireCtx();
  requireModule(ctx, "appointments");
  const sp = await searchParams;
  const day = parseDateInput(sp.date) ?? istDate();
  const { start, end } = istDayRange(day);
  const [appointments, practitioners, preselected] = await Promise.all([
    db.appointment.findMany({
      where: { orgId: ctx.org.id, startsAt: { gte: start, lt: end } },
      include: { contact: true, provider: { include: { user: true } } },
      orderBy: { startsAt: "asc" },
    }),
    db.membership.findMany({ where: { orgId: ctx.org.id, active: true, role: { in: ["OWNER", "PRACTITIONER"] } }, include: { user: true } }),
    sp.contact ? findContact(ctx, sp.contact) : null,
  ]);
  const usesQueue = hasModule(ctx.org.vertical, "queue");
  const isToday = day.getTime() === istDate().getTime();
  const t = ctx.pack.terms;

  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle={formatDate(day)}
        actions={
          <div className="flex gap-1">
            <Link href={`/app/appointments?date=${toDateInput(addDays(day, -1))}`} className="btn-secondary">←</Link>
            <Link href="/app/appointments" className="btn-secondary">Today</Link>
            <Link href={`/app/appointments?date=${toDateInput(addDays(day, 1))}`} className="btn-secondary">→</Link>
          </div>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title={`${appointments.length} appointment(s)`} className="lg:col-span-2">
          {appointments.length === 0 ? (
            <Empty>No appointments on this day.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>Time</th><th>{t.contact}</th><th>With</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {appointments.map((a) => (
                    <tr key={a.id}>
                      <td className="whitespace-nowrap font-medium">{formatTime(a.startsAt)}</td>
                      <td>
                        <Link href={`/app/contacts/${a.contactId}`} className="link">{a.contact.name}</Link>
                        <div className="text-xs text-slate-500">{formatPhone(a.contact.phone)}{a.notes && ` · ${a.notes}`}</div>
                      </td>
                      <td className="text-sm">{a.provider?.user.name ?? "—"}</td>
                      <td><AppointmentBadge status={a.status} /></td>
                      <td>
                        {a.status === "BOOKED" && (
                          <div className="flex justify-end gap-1">
                            {usesQueue && isToday ? (
                              <StatusButton id={a.id} status="CHECKED_IN" label="Check in" className="btn-primary btn-sm" />
                            ) : (
                              <StatusButton id={a.id} status="COMPLETED" label="Done" className="btn-primary btn-sm" />
                            )}
                            <StatusButton id={a.id} status="NO_SHOW" label="No-show" />
                            <StatusButton id={a.id} status="CANCELLED" label="✕" className="btn-ghost btn-sm" />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Book appointment">
          <ActionForm action={bookAppointmentAction} className="space-y-3">
            {preselected ? (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <input type="hidden" name="contactId" value={preselected.id} />
                <b>{preselected.name}</b> · {formatPhone(preselected.phone)}
              </div>
            ) : (
              <>
                <input name="name" required placeholder={`${t.contact} name`} className="input" aria-label="Name" />
                <input name="phone" type="tel" required placeholder="WhatsApp mobile" className="input" aria-label="Mobile" />
                <input type="hidden" name="whatsappOptIn" value="on" />
                <input type="hidden" name="preferredLang" value="hi" />
              </>
            )}
            <div className="grid grid-cols-2 gap-2">
              <input name="date" type="date" required defaultValue={toDateInput(day)} className="input" aria-label="Date" />
              <input name="time" type="time" required defaultValue="10:00" className="input" aria-label="Time" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select name="providerId" className="input" aria-label={t.practitioner}>
                <option value="">Any {t.practitioner.toLowerCase()}</option>
                {practitioners.map((p) => <option key={p.id} value={p.id}>{p.user.name}</option>)}
              </select>
              <select name="durationMin" className="input" defaultValue="15" aria-label="Duration">
                {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} min</option>)}
              </select>
            </div>
            <select name="source" className="input" aria-label="Booked via" defaultValue="PHONE">
              <option value="PHONE">Booked by phone</option>
              <option value="WHATSAPP">Booked on WhatsApp</option>
              <option value="WALK_IN">At the desk</option>
            </select>
            <input name="notes" placeholder="Reason / notes" className="input" aria-label="Notes" />
            <SubmitButton className="btn-primary w-full">Book & send confirmation</SubmitButton>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
