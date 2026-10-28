import type { Ctx } from "@/platform/kernel/auth";
import { canManage } from "@/platform/kernel/auth";
import { removeCatalogItemAction } from "@/platform/actions/settings";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { Card } from "@/platform/ui/ui";
import { addMedicineAction, updateClinicFeesAction } from "../actions";
import { clinicSettings } from "../consultation";
import { FREQUENCIES, TIMINGS, instruction, sanitizeRxItems } from "../rx";

/** Clinic-specific settings: fees and favourite medicines. Rendered inside the platform's Settings page. */
export async function ClinicSettings({ ctx }: { ctx: Ctx }) {
  const manager = canManage(ctx);
  const s = clinicSettings(ctx);
  const medicines = await ctx.db.catalogItem.findMany({ where: { kind: "MEDICINE", active: true }, orderBy: { name: "asc" } });

  return (
    <>
      <Card title="Consultation fees">
        <ActionForm action={updateClinicFeesAction} className="space-y-3">
          <fieldset disabled={!manager} className="grid grid-cols-2 gap-3">
            <label className="text-xs text-slate-600">Consultation fee (₹)<input name="consultationFee" type="number" min={0} defaultValue={s.consultationFee} className="input mt-1" /></label>
            <label className="text-xs text-slate-600">Follow-up fee (₹)<input name="followUpFee" type="number" min={0} defaultValue={s.followUpFee} className="input mt-1" /></label>
            <label className="text-xs text-slate-600">Follow-up window (days)<input name="followUpFreeDays" type="number" min={0} defaultValue={s.followUpFreeDays} className="input mt-1" /></label>
          </fieldset>
          {manager && <SubmitButton>Save</SubmitButton>}
        </ActionForm>
      </Card>

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
          <ActionForm action={addMedicineAction} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
            <input name="name" required placeholder="Tab. Name 500" className="input col-span-2" aria-label="Medicine" />
            <input name="dose" placeholder="Dose" className="input" aria-label="Dose" />
            <select name="frequency" className="input" aria-label="Frequency">{FREQUENCIES.map((f) => <option key={f}>{f}</option>)}</select>
            <select name="timing" className="input" aria-label="Timing">{TIMINGS.map((t) => <option key={t.value} value={t.value}>{t.en}</option>)}</select>
            <input name="days" type="number" min={1} placeholder="Days" className="input" aria-label="Days" />
            <SubmitButton className="btn-secondary col-span-2 sm:col-span-1">Add</SubmitButton>
          </ActionForm>
        )}
      </Card>
    </>
  );
}
