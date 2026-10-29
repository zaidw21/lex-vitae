import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signup } from "@/platform/actions/auth";
import { ActionForm, SubmitButton } from "@/platform/ui/action-form";
import { Logo } from "@/platform/ui/logo";
import { getCtx } from "@/platform/kernel/auth";
import { api } from "@/platform/api/client";
import type { AppInfo } from "@/platform/api/types";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage() {
  if (await getCtx()) redirect("/app");
  const apps = await api.public<AppInfo[]>("/api/apps");
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-semibold">Set up your practice</h1>
          <p className="mt-1 text-sm text-slate-500">30-day free trial. No card needed.</p>
          <ActionForm action={signup} className="mt-5 space-y-4">
            <fieldset>
              <legend className="label">What kind of practice?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {apps.map((p, i) => (
                  <label key={p.id} className="card flex cursor-pointer gap-3 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                    <input type="radio" name="app" value={p.id} defaultChecked={i === 0} className="mt-1 accent-brand-600" />
                    <span>
                      <span className="block text-sm font-semibold">{p.name}</span>
                      <span className="block text-xs text-slate-500">{p.tagline}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="orgName">Practice name</label>
                <input id="orgName" name="orgName" required className="input" placeholder="Sharma Family Clinic" />
              </div>
              <div>
                <label className="label" htmlFor="city">City</label>
                <input id="city" name="city" className="input" placeholder="Indore" />
              </div>
              <div>
                <label className="label" htmlFor="name">Your name</label>
                <input id="name" name="name" required autoComplete="name" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="phone">Mobile</label>
                <input id="phone" name="phone" type="tel" autoComplete="tel" className="input" placeholder="98xxxxxxxx" />
              </div>
              <div>
                <label className="label" htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required autoComplete="email" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="password">Password</label>
                <input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" className="input" />
              </div>
            </div>
            <SubmitButton className="btn-primary w-full" pendingText="Creating…">Create my practice</SubmitButton>
          </ActionForm>
        </div>
        <p className="mt-4 text-center text-sm text-slate-600">
          Already have an account? <Link href="/login" className="link">Log in</Link>
        </p>
      </div>
    </main>
  );
}
