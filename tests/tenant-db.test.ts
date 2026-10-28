import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/platform/lib/db";
import { tenantDb, TenantViolation } from "@/platform/kernel/tenant-db";

// Integration test against the real database (skipped when DATABASE_URL is not set).
try {
  process.loadEnvFile(".env");
} catch {
  // CI provides DATABASE_URL directly.
}
const run = process.env.DATABASE_URL ? describe : describe.skip;

run("tenant-scoped database", () => {
  const tag = `tenant-test-${Date.now()}`;
  let a: string, b: string, contactA: string, contactB: string;

  beforeAll(async () => {
    a = (await db.organization.create({ data: { name: `${tag}-a`, slug: `${tag}-a`, app: "clinic" } })).id;
    b = (await db.organization.create({ data: { name: `${tag}-b`, slug: `${tag}-b`, app: "clinic" } })).id;
    contactA = (await db.contact.create({ data: { orgId: a, name: "Asha A", phone: "+919800000001" } })).id;
    contactB = (await db.contact.create({ data: { orgId: b, name: "Bina B", phone: "+919800000002" } })).id;
  });

  afterAll(async () => {
    // App-owned tables have no foreign key to Organization, so they don't cascade.
    await db.matter.deleteMany({ where: { orgId: { in: [a, b] } } });
    await db.organization.deleteMany({ where: { id: { in: [a, b] } } });
    await db.$disconnect();
  });

  it("filters reads and aggregates to the current organization", async () => {
    const t = tenantDb(a);
    expect((await t.contact.findMany()).map((c) => c.id)).toEqual([contactA]);
    expect(await t.contact.count()).toBe(1);
    expect(await t.contact.findFirst({ where: { id: contactB } })).toBeNull();
    const grouped = await t.contact.groupBy({ by: ["orgId"], _count: true });
    expect(grouped.map((g) => g.orgId)).toEqual([a]);
  });

  it("hides another organization's row on unique lookups", async () => {
    const t = tenantDb(a);
    expect(await t.contact.findUnique({ where: { id: contactB } })).toBeNull();
    expect((await t.contact.findUnique({ where: { id: contactA }, select: { name: true } }))?.name).toBe("Asha A");
    await expect(t.contact.findUniqueOrThrow({ where: { id: contactB } })).rejects.toBeInstanceOf(TenantViolation);
  });

  it("refuses to update, delete or upsert another organization's row", async () => {
    const t = tenantDb(a);
    await expect(t.contact.update({ where: { id: contactB }, data: { name: "hacked" } })).rejects.toBeInstanceOf(TenantViolation);
    await expect(t.contact.delete({ where: { id: contactB } })).rejects.toBeInstanceOf(TenantViolation);
    await expect(
      t.counter.upsert({ where: { orgId_key: { orgId: b, key: "x" } }, create: { orgId: b, key: "x" }, update: { value: { increment: 1 } } }),
    ).rejects.toBeInstanceOf(TenantViolation);
    expect((await db.contact.findUniqueOrThrow({ where: { id: contactB } })).name).toBe("Bina B");
  });

  it("bulk writes only touch the current organization", async () => {
    const t = tenantDb(a);
    const res = await t.contact.updateMany({ data: { address: "updated" } });
    expect(res.count).toBe(1);
    expect((await db.contact.findUniqueOrThrow({ where: { id: contactB } })).address).toBeNull();
  });

  it("stamps the current organization on creates, even if another is passed", async () => {
    const t = tenantDb(a);
    const c = await t.contact.create({ data: { orgId: b, name: "Sneaky", phone: "+919800000003" } });
    expect(c.orgId).toBe(a);
    const upserted = await t.counter.upsert({ where: { orgId_key: { orgId: a, key: "x" } }, create: { orgId: a, key: "x" }, update: {} });
    expect(upserted.orgId).toBe(a);
  });

  it("keeps isolation inside interactive transactions", async () => {
    const t = tenantDb(a);
    const ids = await t.$transaction(async (tx) => (await tx.contact.findMany()).map((c) => c.orgId));
    expect(new Set(ids)).toEqual(new Set([a]));
    await expect(t.$transaction((tx) => tx.contact.update({ where: { id: contactB }, data: { name: "x" } }))).rejects.toBeInstanceOf(TenantViolation);
  });

  it("covers app-owned tables too (legal Matter)", async () => {
    await db.matter.create({ data: { orgId: b, contactId: contactB, title: "B's case" } });
    expect(await tenantDb(a).matter.count()).toBe(0);
    expect(await tenantDb(b).matter.count()).toBe(1);
  });
});
