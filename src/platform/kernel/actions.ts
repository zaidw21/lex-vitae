import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";
import { captureError } from "@/platform/telemetry/errors";
import { log } from "@/platform/telemetry/logger";
import { withTelemetryContext } from "@/platform/telemetry/context";
import { UserError } from "@/platform/lib/errors";
import type { FormState } from "@/platform/lib/form-state";
import { requireCtx, type Ctx } from "./auth";

// Every server action runs through one of these wrappers, so apps get authentication,
// tenant context, structured logs, timing and error capture without writing any of it.

export { UserError };

async function run<T>(name: string, ctx: Ctx | null, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  return withTelemetryContext(
    { requestId: randomUUID(), action: name, orgId: ctx?.org.id, userId: ctx?.user.id, app: ctx?.app.id },
    async () => {
      try {
        const result = await fn();
        log.info("action.ok", { durationMs: Date.now() - started });
        return result;
      } catch (err) {
        try {
          unstable_rethrow(err); // redirect()/notFound() are control flow, not failures
        } catch (control) {
          log.info("action.ok", { durationMs: Date.now() - started, navigates: true });
          throw control;
        }
        if (err instanceof UserError) log.info("action.rejected", { durationMs: Date.now() - started, reason: err.message });
        else captureError(err, { durationMs: Date.now() - started });
        throw err;
      }
    },
  );
}

function toFormState(err: unknown): FormState {
  unstable_rethrow(err);
  return { error: err instanceof UserError ? err.message : "Something went wrong. Please try again." };
}

/** A signed-in form action (used with `ActionForm`). Errors become `{ error }` for the form. */
export function formAction(name: string, fn: (ctx: Ctx, form: FormData) => Promise<FormState | void>) {
  return async (_state: FormState, form: FormData): Promise<FormState> => {
    try {
      const ctx = await requireCtx();
      return (await run(name, ctx, () => fn(ctx, form))) ?? null;
    } catch (err) {
      return toFormState(err);
    }
  };
}

/** A form action that works without a session (sign-up, log-in). */
export function publicFormAction(name: string, fn: (form: FormData) => Promise<FormState | void>) {
  return async (_state: FormState, form: FormData): Promise<FormState> => {
    try {
      return (await run(name, null, () => fn(form))) ?? null;
    } catch (err) {
      return toFormState(err);
    }
  };
}

/** A signed-in action for plain `<form action>` buttons. Errors reach the error boundary. */
export function action(name: string, fn: (ctx: Ctx, form: FormData) => Promise<void>) {
  return async (form: FormData): Promise<void> => {
    const ctx = await requireCtx();
    await run(name, ctx, () => fn(ctx, form));
  };
}
