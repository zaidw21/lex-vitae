import { notFound } from "next/navigation";
import { hasModule, type ModuleKey } from "@/verticals";
import type { Ctx } from "./auth";

export function requireModule(ctx: Ctx, module: ModuleKey): void {
  if (!hasModule(ctx.org.vertical, module)) notFound();
}

export interface NavItem {
  module: ModuleKey;
  href: string;
  label: string;
  icon: string;
}

export function navFor(ctx: Ctx): NavItem[] {
  const t = ctx.pack.terms;
  const all: NavItem[] = [
    { module: "dashboard", href: "/app", label: "Today", icon: "🏠" },
    { module: "queue", href: "/app/queue", label: "Queue", icon: "🎫" },
    { module: "hearings", href: "/app/hearings", label: "Hearing diary", icon: "📅" },
    { module: "appointments", href: "/app/appointments", label: "Appointments", icon: "🗓️" },
    { module: "matters", href: "/app/matters", label: "Matters", icon: "📁" },
    { module: "contacts", href: "/app/contacts", label: t.contacts, icon: "👥" },
    { module: "billing", href: "/app/billing", label: "Billing", icon: "₹" },
    { module: "tasks", href: "/app/tasks", label: "Follow-ups", icon: "⏰" },
    { module: "messages", href: "/app/messages", label: "WhatsApp", icon: "💬" },
    { module: "settings", href: "/app/settings", label: "Settings", icon: "⚙️" },
  ];
  return all.filter((i) => ctx.pack.modules.includes(i.module));
}
