import { changeOrg, logout } from "@/platform/actions/auth";
import { Logo } from "@/platform/ui/logo";
import { NavLinks } from "@/platform/ui/nav-links";
import { listMemberships, requireCtx } from "@/platform/kernel/auth";
import { navFor } from "@/platform/kernel/modules";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireCtx();
  const memberships = await listMemberships(ctx.user.id);
  const nav = navFor(ctx);

  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:w-60 md:shrink-0 md:flex-col md:border-b-0 md:border-r print:hidden">
        <div className="flex items-center justify-between px-4 py-4">
          <Logo href="/app" product={ctx.app.name.replace(/^Arcus /, "")} />
        </div>
        <div className="px-3 pb-3">
          {memberships.length > 1 ? (
            <form action={changeOrg} className="flex gap-1">
              <select name="orgId" defaultValue={ctx.org.id} className="input py-1.5 text-xs" aria-label="Switch practice">
                {memberships.map((m) => (
                  <option key={m.org.id} value={m.org.id}>
                    {m.org.name}
                  </option>
                ))}
              </select>
              <button className="btn-secondary btn-sm">Go</button>
            </form>
          ) : (
            <div className="truncate rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">{ctx.org.name}</div>
          )}
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto">
          <NavLinks items={nav} />
        </nav>
        <div className="hidden border-t border-slate-100 p-3 md:block">
          <div className="truncate px-1 text-sm font-medium">{ctx.user.name}</div>
          <div className="truncate px-1 text-xs text-slate-500">{ctx.membership.role.toLowerCase()} · {ctx.app.name}</div>
          <form action={logout} className="mt-2">
            <button className="btn-ghost btn-sm w-full justify-start">Log out</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
