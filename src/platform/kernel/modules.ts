import { notFound } from "next/navigation";
import { appointmentsModule } from "@/platform/modules/appointments/module";
import { queueModule } from "@/platform/modules/queue/module";
import type { Ctx } from "./auth";
import type { Extension, ModuleId, ModuleManifest, NavItem } from "./types";

export const MODULES: Record<ModuleId, ModuleManifest> = {
  queue: queueModule,
  appointments: appointmentsModule,
};

/** Modules this organization has switched on, limited to what its app allows. */
export function enabledModules(app: { modules: ModuleId[]; optionalModules?: ModuleId[] }, orgModules: string[]): ModuleId[] {
  const allowed = new Set<ModuleId>([...app.modules, ...(app.optionalModules ?? [])]);
  return orgModules.filter((m): m is ModuleId => allowed.has(m as ModuleId));
}

export function hasModule(ctx: Ctx, id: ModuleId): boolean {
  return ctx.modules.includes(id);
}

export function requireModule(ctx: Ctx, id: ModuleId): void {
  if (!hasModule(ctx, id)) notFound();
}

/** 404 unless the signed-in organization runs this app. Used by app-owned pages and actions. */
export function requireApp(ctx: Ctx, appId: string): void {
  if (ctx.app.id !== appId) notFound();
}

/** Everything plugged into this organization: enabled modules first, then its app. */
export function extensions(ctx: Ctx): Extension[] {
  return [...ctx.modules.map((m) => MODULES[m]), ctx.app];
}

export function navFor(ctx: Ctx): NavItem[] {
  return [
    { href: "/app", label: "Today", icon: "🏠" },
    ...extensions(ctx).flatMap((e) => e.nav ?? []),
    { href: "/app/contacts", label: ctx.app.terms.contacts, icon: "👥" },
    { href: "/app/billing", label: "Billing", icon: "₹" },
    { href: "/app/tasks", label: "Follow-ups", icon: "⏰" },
    { href: "/app/messages", label: "WhatsApp", icon: "💬" },
    { href: "/app/settings", label: "Settings", icon: "⚙️" },
  ];
}
