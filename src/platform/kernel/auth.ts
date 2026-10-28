import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Membership, Organization, Role, User } from "@prisma/client";
import { db } from "@/platform/lib/db";
import { appFor } from "@/registry";
import { config } from "./config";
import { enabledModules } from "./modules";
import { tenantDb, type TenantDb } from "./tenant-db";
import type { AppManifest, ModuleId } from "./types";

const COOKIE = "arcus_session";
const SESSION_DAYS = 30;

/** Everything a page or action needs about the current request. */
export interface Ctx {
  user: User;
  membership: Membership;
  org: Organization;
  /** The app this organization runs (terms, modules, extensions). */
  app: AppManifest;
  /** Platform modules switched on for this organization. */
  modules: ModuleId[];
  /** Database client scoped to this organization (see tenant-db.ts). */
  db: TenantDb;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function startSession(userId: string, orgId: string | null): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { id: hashToken(token), userId, orgId, expiresAt } });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config().NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: hashToken(token) } });
  store.delete(COOKIE);
}

async function currentSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: hashToken(token) }, include: { user: true } });
  if (!session || session.expiresAt < new Date()) return null;
  return session;
}

export async function switchOrg(orgId: string): Promise<boolean> {
  const session = await currentSession();
  if (!session) return false;
  const membership = await db.membership.findUnique({
    where: { orgId_userId: { orgId, userId: session.userId } },
  });
  if (!membership?.active) return false;
  await db.session.update({ where: { id: session.id }, data: { orgId } });
  return true;
}

/** The signed-in user and their active organization, or null. Cached per request. */
export const getCtx = cache(async (): Promise<Ctx | null> => {
  const session = await currentSession();
  if (!session) return null;
  const memberships = await db.membership.findMany({
    where: { userId: session.userId, active: true },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });
  const membership = memberships.find((m) => m.orgId === session.orgId) ?? memberships[0];
  if (!membership) return null;
  const { org, ...rest } = membership;
  const app = appFor(org.app);
  return { user: session.user, membership: rest, org, app, modules: enabledModules(app, org.modules), db: tenantDb(org.id) };
});

export async function requireCtx(): Promise<Ctx> {
  const ctx = await getCtx();
  if (!ctx) redirect("/login");
  return ctx;
}

export function canManage(ctx: Ctx): boolean {
  return ctx.membership.role === "OWNER" || ctx.membership.role === "ADMIN";
}

export async function requireRole(roles: Role[]): Promise<Ctx> {
  const ctx = await requireCtx();
  if (!roles.includes(ctx.membership.role)) throw new Error("You do not have permission to do this.");
  return ctx;
}

export async function listMemberships(userId: string) {
  return db.membership.findMany({
    where: { userId, active: true },
    include: { org: { select: { id: true, name: true, app: true } } },
    orderBy: { createdAt: "asc" },
  });
}
