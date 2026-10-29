import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { api, ApiError, SESSION_COOKIE } from "@/platform/api/client";
import type { Member, Org, Role, SessionInfo } from "@/platform/api/types";
import { appUi } from "@/registry";
import type { AppManifest } from "./types";

/** Everything a page or action knows about the current request, from the API's /api/session. */
export interface Ctx {
  user: { id: string; name: string };
  membership: Member & { role: Role };
  org: Org;
  /** The organization's app: its config from the API merged with its UI from the web registry. */
  app: AppManifest;
  /** Modules switched on for this organization. */
  modules: string[];
  session: SessionInfo;
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** The signed-in context, or null. Cached per request. */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  if (!(await cookies()).get(SESSION_COOKIE)) return null;
  try {
    const s = await api.get<SessionInfo>("/api/session");
    return {
      user: { id: s.principal.userId, name: s.principal.userName },
      membership: s.me,
      org: s.org,
      app: { ...s.app, ...appUi(s.app.id) },
      modules: s.modules.filter((m) => m.enabled).map((m) => m.id),
      session: s,
    };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) return null;
    throw err;
  }
});

export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

export function canManage(ctx: Ctx): boolean {
  return ctx.membership.role === "OWNER" || ctx.membership.role === "ADMIN";
}

/** Load data for a page: a 403/404 from the API becomes the not-found page, 401 goes to login. */
export async function load<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) redirect("/login");
      if (err.status === 403 || err.status === 404) notFound();
    }
    throw err;
  }
}
