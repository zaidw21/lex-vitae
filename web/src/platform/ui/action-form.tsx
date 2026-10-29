"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/platform/lib/form-state";

export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: FormState, form: FormData) => Promise<FormState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {state.ok}
        </p>
      )}
    </form>
  );
}

export function SubmitButton({ children, className = "btn-primary", pendingText }: { children: ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? (pendingText ?? "Saving…") : children}
    </button>
  );
}
