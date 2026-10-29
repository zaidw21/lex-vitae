import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/platform/actions/auth";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { Logo } from "@/platform/ui/logo";
import { getCtx } from "@/platform/kernel/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage() {
  if (await getCtx()) redirect("/app");
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-semibold">Log in</h1>
          <ActionForm action={login} className="mt-5 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
            </div>
            <SubmitButton className="btn-primary w-full" pendingText="Logging in…">Log in</SubmitButton>
          </ActionForm>
          <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
            Demo: <b>demo@example.com</b> / <b>demo1234</b> (a clinic and a law chamber)
          </p>
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          New to Arcus? <Link href="/signup" className="link">Create an account</Link>
        </p>
      </div>
    </main>
  );
}
