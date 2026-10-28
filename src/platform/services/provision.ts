import type { Organization, User } from "@prisma/client";
import { db } from "@/platform/lib/db";
import { slugify } from "@/platform/lib/ids";
import type { AppConfig } from "@/platform/kernel/types";

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "practice";
  for (let i = 0; ; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await db.organization.findUnique({ where: { slug } }))) return slug;
  }
}

/** Create an organization running `app`, with its owner, the app's modules and starter catalog. */
export async function provisionOrganization(input: {
  name: string;
  city: string | null;
  phone: string | null;
  app: AppConfig;
  owner: User;
}): Promise<Organization> {
  const { app } = input;
  const slug = await uniqueSlug(`${input.name} ${input.city ?? ""}`);
  return db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug,
        app: app.id,
        modules: app.modules,
        city: input.city,
        phone: input.phone,
        settings: app.defaultSettings as object,
      },
    });
    await tx.membership.create({ data: { orgId: org.id, userId: input.owner.id, role: "OWNER" } });
    await tx.catalogItem.createMany({
      data: app.defaultServices.map((s) => ({ orgId: org.id, kind: "SERVICE", name: s.name, price: s.price * 100 })),
    });
    await app.provision?.(tx, org.id);
    return org;
  });
}
