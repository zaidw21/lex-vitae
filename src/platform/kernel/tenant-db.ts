import { Prisma } from "@prisma/client";
import { db } from "@/platform/lib/db";

/**
 * Tenant isolation, enforced by the platform rather than by every query remembering to filter.
 *
 * `tenantDb(orgId)` is a Prisma client where, for every model with a required `orgId` column:
 *  - reads and bulk writes are always filtered to this organization,
 *  - creates always stamp this organization's id (overriding anything passed in),
 *  - single-row reads by unique key return null for another organization's row,
 *  - single-row update/delete/upsert refuse to touch another organization's row.
 * App code receives this client as `ctx.db` and never sees the unscoped client.
 */

const TENANT_MODELS = new Set(
  Prisma.dmmf.datamodel.models.filter((m) => m.fields.some((f) => f.name === "orgId" && f.isRequired)).map((m) => m.name),
);

const FILTERED = new Set(["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "updateMany", "deleteMany"]);

export class TenantViolation extends Error {
  constructor(model: string, operation: string) {
    super(`${model}.${operation} attempted on a record outside the current organization.`);
    this.name = "TenantViolation";
  }
}

type Args = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function delegate(model: string) {
  return (db as unknown as Record<string, { findFirst(args: Args): Promise<unknown> }>)[model[0].toLowerCase() + model.slice(1)];
}

/** Who owns the row a unique `where` (e.g. {id}, {publicCode}, {orgId_key: {...}}) points at? */
async function ownerOf(model: string, where: Args, orgId: string): Promise<"this" | "other" | "none"> {
  const compound = "orgId" in where ? where : Object.values(where).find((v) => v && typeof v === "object" && "orgId" in v);
  if (compound) return (compound as Args).orgId === orgId ? "this" : "other";
  const row = (await delegate(model).findFirst({ where, select: { orgId: true } })) as Args | null;
  if (!row) return "none";
  return row.orgId === orgId ? "this" : "other";
}

export function tenantDb(orgId: string) {
  return db.$extends({
    name: "tenant-isolation",
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!TENANT_MODELS.has(model)) return query(args);
          const a = { ...(args as Args) };

          if (FILTERED.has(operation)) {
            a.where = a.where ? { AND: [a.where, { orgId }] } : { orgId };
            return query(a);
          }
          switch (operation) {
            case "create":
              a.data = { ...a.data, orgId };
              return query(a);
            case "createMany":
            case "createManyAndReturn":
              a.data = (Array.isArray(a.data) ? a.data : [a.data]).map((d: Args) => ({ ...d, orgId }));
              return query(a);
            case "findUnique":
            case "findUniqueOrThrow": {
              if (a.select && !a.select.orgId) a.select = { ...a.select, orgId: true };
              const row = (await query(a)) as Args | null;
              if (row && row.orgId !== orgId) {
                if (operation === "findUniqueOrThrow") throw new TenantViolation(model, operation);
                return null;
              }
              return row;
            }
            case "update":
            case "delete":
            case "upsert":
              // A missing row is left to Prisma (update/delete throw "not found"; upsert creates it).
              if ((await ownerOf(model, a.where, orgId)) === "other") throw new TenantViolation(model, operation);
              if (operation === "upsert") a.create = { ...a.create, orgId };
              return query(a);
            default:
              return query(a);
          }
        },
      },
    },
  });
}

export type TenantDb = ReturnType<typeof tenantDb>;
