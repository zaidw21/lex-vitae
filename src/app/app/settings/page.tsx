import Link from "next/link";
import { logout } from "@/platform/actions/auth";
import { addMemberAction, addServiceAction, removeCatalogItemAction, removeMemberAction, setModulesAction, updateOrgAction, updateProfileAction } from "@/platform/actions/settings";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { Badge, Card, PageHeader } from "@/platform/ui/ui";
import { canManage, requireCtx } from "@/platform/kernel/auth";
import { formatMoney } from "@/platform/lib/money";
import { extensions, MODULES } from "@/platform/kernel/modules";

export default async function SettingsPage() {
  const ctx = await requireCtx();
  const manager = canManage(ctx);
  const s = ctx.org.settings as { gstin?: string };
  const [members, services] = await Promise.all([
    ctx.db.membership.findMany({ where: { active: true }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    ctx.db.catalogItem.findMany({ where: { kind: "SERVICE", active: true }, orderBy: { name: "asc" } }),
  ]);

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
        <Card title={`${ctx.app.terms.practice} profile`}>
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
              {manager && <SubmitButton>Save</SubmitButton>}
            </fieldset>
          </ActionForm>
        </Card>

        <Card title="My details (printed on documents)">
          <ActionForm action={updateProfileAction} className="space-y-3">
            <input name="name" defaultValue={ctx.user.name} required className="input" aria-label="Name" placeholder={`${ctx.app.practitionerPrefix} Full Name`} />
            <input name="qualifications" defaultValue={ctx.membership.qualifications ?? ""} className="input" aria-label="Qualifications" placeholder="Qualifications" />
            <input name="registrationNo" defaultValue={ctx.membership.registrationNo ?? ""} className="input" aria-label="Registration number" placeholder="Registration / enrolment no." />
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
                  <option value="PRACTITIONER">{ctx.app.terms.practitioner}</option>
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
            <ActionForm action={addServiceAction} className="flex gap-2">
              <input name="name" required placeholder="Service" className="input" aria-label="Service" />
              <input name="price" type="number" min={0} placeholder="₹" className="input w-24" aria-label="Price" />
              <SubmitButton className="btn-secondary">Add</SubmitButton>
            </ActionForm>
          )}
        </Card>

        <Card title="Features">
          <ActionForm action={setModulesAction} className="space-y-2">
            <fieldset disabled={!manager} className="space-y-2">
              {[...ctx.app.modules, ...(ctx.app.optionalModules ?? [])].map((id) => (
                <label key={id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" name={`module_${id}`} defaultChecked={ctx.modules.includes(id)} className="mt-0.5 accent-brand-600" />
                  <span>
                    <b>{MODULES[id].name}</b>
                    <span className="block text-xs text-slate-500">{MODULES[id].description}</span>
                  </span>
                </label>
              ))}
              {manager && <SubmitButton className="btn-secondary">Save</SubmitButton>}
            </fieldset>
          </ActionForm>
        </Card>

        {extensions(ctx)
          .flatMap((e) => e.settingsSections ?? [])
          .map((Section, i) => (
            <Section key={i} ctx={ctx} />
          ))}
      </div>
    </>
  );
}
