import { unstable_rethrow } from "next/navigation";
import { ApiError } from "@/platform/api/client";
import { UserError } from "@/platform/lib/errors";
import type { FormState } from "@/platform/lib/form-state";
import { requireCtx, type Ctx } from "./auth";

// Every server action goes through these wrappers: they require a session, and turn API and validation
// errors into messages the form can show. Logging, metrics and error reporting happen in the Java API.

export { UserError };

function toFormState(err: unknown): FormState {
  unstable_rethrow(err); // redirect()/notFound() are control flow
  if (err instanceof UserError) return { error: err.message };
  if (err instanceof ApiError && err.status < 500) return { error: err.message };
  console.error(err);
  return { error: err instanceof ApiError ? err.message : "Something went wrong. Please try again." };
}

/** A signed-in form action (used with `ActionForm`). Errors become `{ error }` for the form. */
export function formAction(_name: string, fn: (ctx: Ctx, form: FormData) => Promise<FormState | void>) {
  return async (_state: FormState, form: FormData): Promise<FormState> => {
    try {
      const ctx = await requireCtx();
      return (await fn(ctx, form)) ?? null;
    } catch (err) {
      return toFormState(err);
    }
  };
}

/** A form action that works without a session (sign-up, log-in). */
export function publicFormAction(_name: string, fn: (form: FormData) => Promise<FormState | void>) {
  return async (_state: FormState, form: FormData): Promise<FormState> => {
    try {
      return (await fn(form)) ?? null;
    } catch (err) {
      return toFormState(err);
    }
  };
}

/** A signed-in action for plain `<form action>` buttons. Errors reach the error boundary. */
export function action(_name: string, fn: (ctx: Ctx, form: FormData) => Promise<void>) {
  return async (form: FormData): Promise<void> => {
    const ctx = await requireCtx();
    await fn(ctx, form);
  };
}
