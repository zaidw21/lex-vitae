import { db } from "@/platform/lib/db";
import { addDays, istDate, istDayRange } from "@/platform/lib/time";

const shortDay = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Daily series for the last `days` IST days: visits (encounters) and collections (payments). */
export async function dailySeries(orgId: string, days = 14) {
  const today = istDate();
  const first = addDays(today, -(days - 1));
  const { start } = istDayRange(first);
  const [encounters, payments] = await Promise.all([
    db.encounter.findMany({ where: { orgId, occurredAt: { gte: start } }, select: { occurredAt: true } }),
    db.payment.findMany({ where: { orgId, receivedAt: { gte: start } }, select: { receivedAt: true, amount: true } }),
  ]);
  const visits = new Map<number, number>();
  const money = new Map<number, number>();
  for (const e of encounters) visits.set(istDate(e.occurredAt).getTime(), (visits.get(istDate(e.occurredAt).getTime()) ?? 0) + 1);
  for (const p of payments) money.set(istDate(p.receivedAt).getTime(), (money.get(istDate(p.receivedAt).getTime()) ?? 0) + p.amount);
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(first, i);
    return { label: shortDay(d), visits: visits.get(d.getTime()) ?? 0, collected: money.get(d.getTime()) ?? 0 };
  });
}

/** Of the people seen in the last 30 days: first-ever visit in that window vs. seen before. */
export async function newVsReturning(orgId: string) {
  const { start } = istDayRange(addDays(istDate(), -29));
  const recent = await db.encounter.findMany({ where: { orgId, occurredAt: { gte: start } }, select: { contactId: true }, distinct: ["contactId"] });
  const ids = recent.map((r) => r.contactId);
  const visits = ids.length
    ? await db.encounter.groupBy({ by: ["contactId"], where: { orgId, contactId: { in: ids } }, _count: true })
    : [];
  const returning = visits.filter((v) => v._count > 1).length;
  return { total: ids.length, returning, new: ids.length - returning };
}
