import Link from "next/link";
import { api } from "@/platform/api/client";
import { canManage, type Ctx } from "@/platform/kernel/auth";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { Card } from "@/platform/ui/ui";
import { updateQueueSettingsAction } from "./actions";

export async function QueueSettings({ ctx }: { ctx: Ctx }) {
  const manager = canManage(ctx);
  const s = await api.get<{ avgMinutes: number }>("/api/modules/queue/settings");
  return (
    <Card title="Queue">
      <ActionForm action={updateQueueSettingsAction} className="space-y-3">
        <fieldset disabled={!manager}>
          <label className="text-xs text-slate-600">
            Estimated minutes per person (used until today has enough data)
            <input name="avgMinutes" type="number" min={2} max={120} defaultValue={s.avgMinutes} className="input mt-1 w-32" />
          </label>
        </fieldset>
        {manager && <SubmitButton>Save</SubmitButton>}
      </ActionForm>
      <p className="mt-3 text-sm">
        Waiting-room screen: <Link href={`/display/${ctx.org.slug}`} target="_blank" className="link">/display/{ctx.org.slug}</Link>
      </p>
    </Card>
  );
}
