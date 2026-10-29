"use server";

import { redirect } from "next/navigation";
import { api } from "@/platform/api/client";
import { str } from "@/platform/lib/form";
import { publicFormAction } from "@/platform/kernel/actions";
import { clearSessionCookie, setSessionCookie } from "@/platform/kernel/auth";

export const signup = publicFormAction("auth.signup", async (form) => {
  const { token } = await api.public<{ token: string }>("/api/auth/signup", {
    name: str(form, "name"),
    email: str(form, "email"),
    phone: str(form, "phone"),
    password: String(form.get("password") ?? ""),
    orgName: str(form, "orgName"),
    city: str(form, "city"),
    app: str(form, "app"),
  });
  await setSessionCookie(token);
  redirect("/app");
});

export const login = publicFormAction("auth.login", async (form) => {
  const { token } = await api.public<{ token: string }>("/api/auth/login", { email: str(form, "email"), password: String(form.get("password") ?? "") });
  await setSessionCookie(token);
  redirect("/app");
});

export async function logout(): Promise<void> {
  await api.post("/api/auth/logout").catch(() => undefined);
  await clearSessionCookie();
  redirect("/login");
}

export async function changeOrg(form: FormData): Promise<void> {
  await api.post("/api/auth/switch-org", { orgId: str(form, "orgId") });
  redirect("/app");
}
