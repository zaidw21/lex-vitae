import Link from "next/link";
import { logout } from "@/actions/auth";
import { addCatalogItemAction, addMemberAction, removeCatalogItemAction, removeMemberAction, updateOrgAction, updateProfileAction } from "@/actions/settings";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { canManage, requireCtx } from "@/core/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { FREQUENCIES, TIMINGS, instruction, sanitizeRxItems } from "@/verticals/clinic/rx";

export default async function SettingsPage() {
  const ctx = await requireCtx();
  const manager = canManage(ctx);
  const isClinic = ctx.org.vertical === "CLINIC";
  const s = ctx.org.settings as { gstin?: string; consultationFee?: number; followUpFee?: number; followUpFreeDays?: number; avgConsultMinutes?: number };
  const [members, catalog] = await Promise.all([
    db.membership.findMany({ where: { orgId: ctx.org.id, active: true }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    db.catalogItem.findMany({ where: { orgId: ctx.org.id, active: true }, orderBy: { name: "asc" } }),
  ]);
  const services = catalog.filter((c) => c.kind === "SERVICE");
  const medicines = catalog.filter((c) => c.kind === "MEDICINE");

  return (
    <>
      <PageHeader
        title="Settings"
        actions={
          <>
            {manager && <Link href="/app/audit" className="btn-secondary">Audit log</Link>}
            <form action={logout}><button className="btn-ghost">Log out</button></form>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title={`${ctx.pack.terms.practice} profile`}>
          <ActionForm action={updateOrgAction} className="space-y-3">
            <fieldset disabled={!manager} className="space-y-3">
              <input name="name" defaultValue={ctx.org.name} required className="input" aria-label="Name" />
              <div className="grid grid-cols-2 gap-2">
                <input name="phone" defaultValue={ctx.org.phone?.replace(/^\+91/, "") ?? ""} placeholder="Phone" className="input" aria-label="Phone" />
                <input name="city" defaultValue={ctx.org.city ?? ""} placeholder="City" className="input" aria-label="City" />
              </div>
              <input name="address" defaultValue={ctx.org.address ?? ""} placeholder="Address (shown on letterhead)" className="input" aria-label="Address" />
              <div className="grid grid-cols-2 gap-2">
                <input name="email" defaultValue={ctx.org.email ?? ""} placeholder="Email" className="input" aria-label="Email" />
                <input name="gstin" defaultValue={s.gstin ?? ""} placeholder="GSTIN (optional)" className="input" aria-label="GSTIN" />
              </div>
              {isClinic && (
                <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                  <label className="text-xs text-slate-600">Consultation fee (₹)<input name="consultationFee" type="number" min={0} defaultValue={s.consultationFee ?? 400} className="input mt-1" /></label>
                  <label className="text-xs text-slate-600">Follow-up fee (₹)<input name="followUpFee" type="number" min={0} defaultValue={s.followUpFee ?? 0} className="input mt-1" /></label>
                  <label className="text-xs text-slate-600">Follow-up window (days)<input name="followUpFreeDays" type="number" min={0} defaultValue={s.followUpFreeDays ?? 7} className="input mt-1" /></label>
                  <label className="text-xs text-slate-600">Avg. consult (min)<input name="avgConsultMinutes" type="number" min={2} max={60} defaultValue={s.avgConsultMinutes ?? 8} className="input mt-1" /></label>
                </div>
              )}
              {manager && <SubmitButton>Save</SubmitButton>}
            </fieldset>
          </ActionForm>
        </Card>

        <Card title="My details (printed on documents)">
          <ActionForm action={updateProfileAction} className="space-y-3">
            <input name="name" defaultValue={ctx.user.name} required className="input" aria-label="Name" placeholder={`${ctx.pack.practitionerPrefix} Full Name`} />
            <input name="qualifications" defaultValue={ctx.membership.qualifications ?? ""} className="input" aria-label="Qualifications" placeholder={isClinic ? "MBBS, MD (Medicine)" : "B.A. LL.B., Advocate"} />
            <input name="registrationNo" defaultValue={ctx.membership.registrationNo ?? ""} className="input" aria-label="Registration number" placeholder={isClinic ? "MP Medical Council Reg. No." : "Bar Council enrolment no."} />
            <SubmitButton>Save</SubmitButton>
          </ActionForm>
        </Card>

        <Card title="Team">
          <ul className="mb-4 divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {m.user.name} <span className="text-xs text-slate-500">· {m.user.email}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge tone={m.role === "OWNER" ? "violet" : "gray"}>{m.role.toLowerCase()}</Badge>
                  {manager && m.role !== "OWNER" && (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="id" value={m.id} />
                      <button className="btn-ghost btn-sm" aria-label={`Remove ${m.user.name}`}>✕</button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {manager && (
            <ActionForm action={addMemberAction} className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input name="name" required placeholder="Name" className="input" aria-label="Name" />
                <input name="email" type="email" required placeholder="Email" className="input" aria-label="Email" />
                <select name="role" className="input" aria-label="Role" defaultValue="STAFF">
                  <option value="STAFF">Front desk / staff</option>
                  <option value="PRACTITIONER">{ctx.pack.terms.practitioner}</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <input name="password" type="text" placeholder="Temporary password" className="input" aria-label="Temporary password" />
              </div>
              <SubmitButton className="btn-secondary">Add team member</SubmitButton>
            </ActionForm>
          )}
        </Card>

        <Card title="Services & fees">
          <ul className="mb-4 divide-y divide-slate-100">
            {services.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-1.5 text-sm">
                <span>{c.name}</span>
                <span className="flex items-center gap-2">
                  {formatMoney(c.price)}
                  {manager && (
                    <form action={removeCatalogItemAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button className="btn-ghost btn-sm" aria-label={`Remove ${c.name}`}>✕</button>
                    </form>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {manager && (
            <ActionForm action={addCatalogItemAction} className="flex gap-2">
              <input type="hidden" name="kind" value="SERVICE" />
              <input name="name" required placeholder="Service" className="input" aria-label="Service" />
              <input name="price" type="number" min={0} placeholder="₹" className="input w-24" aria-label="Price" />
              <SubmitButton className="btn-secondary">Add</SubmitButton>
            </ActionForm>
          )}
        </Card>

        {isClinic && (
          <Card title="Favourite medicines (one-tap in prescriptions)" className="lg:col-span-2">
            <ul className="mb-4 grid gap-x-6 sm:grid-cols-2">
              {medicines.map((c) => {
                const item = sanitizeRxItems([{ name: c.name, ...(c.data as object) }])[0];
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 border-b border-slate-100 py-1.5 text-sm">
                    <span>
                      {c.name} <span className="text-xs text-slate-500">· {item ? `${item.frequency}, ${instruction(item, "en")}` : ""}</span>
                    </span>
                    {manager && (
                      <form action={removeCatalogItemAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn-ghost btn-sm" aria-label={`Remove ${c.name}`}>✕</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
            {manager && (
              <ActionForm action={addCatalogItemAction} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <input type="hidden" name="kind" value="MEDICINE" />
                <input name="name" required placeholder="Tab. Name 500" className="input col-span-2" aria-label="Medicine" />
                <input name="dose" placeholder="Dose" className="input" aria-label="Dose" />
                <select name="frequency" className="input" aria-label="Frequency">{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select>
                <select name="timing" className="input" aria-label="Timing">{TIMINGS.map((t) => <option key={t.value} value={t.value}>{t.en}</option>)}</select>
                <input name="days" type="number" min={1} placeholder="Days" className="input" aria-label="Days" />
                <SubmitButton className="btn-secondary col-span-2 sm:col-span-1">Add</SubmitButton>
              </ActionForm>
            )}
          </Card>
        )}
      </div>
    </>
  );
}
