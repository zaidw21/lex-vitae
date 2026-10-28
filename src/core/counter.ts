import type { Prisma } from "@prisma/client";

/** Next value of a per-organization sequence (e.g. invoice numbers). Call inside a transaction. */
export async function nextNumber(tx: Prisma.TransactionClient, orgId: string, key: string): Promise<number> {
  const counter = await tx.counter.upsert({
    where: { orgId_key: { orgId, key } },
    create: { orgId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return counter.value;
}
