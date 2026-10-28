import type { Organization, User, Vertical } from "@prisma/client";
import { db } from "@/lib/db";
import { slugify } from "@/lib/ids";
import { packFor } from "@/verticals";
import { STARTER_MEDICINES } from "@/verticals/clinic/rx";

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name) || "practice";
  for (let i = 0; ; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    if (!(await db.organization.findUnique({ where: { slug } }))) return slug;
  }
}

/** Create an organization with its owner and the vertical pack's starter catalog. */
export async function provisionOrganization(input: {
  name: string;
  city: string | null;
  phone: string | null;
  vertical: Vertical;
  owner: User;
}): Promise<Organization> {
  const pack = packFor(input.vertical);
  const slug = await uniqueSlug(`${input.name} ${input.city ?? ""}`);
  return db.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug,
        vertical: input.vertical,
        city: input.city,
        phone: input.phone,
        settings: pack.defaultSettings as object,
      },
    });
    await tx.membership.create({ data: { orgId: org.id, userId: input.owner.id, role: "OWNER" } });
    await tx.catalogItem.createMany({
      data: [
        ...pack.defaultServices.map((s) => ({ orgId: org.id, kind: "SERVICE" as const, name: s.name, price: s.price * 100 })),
        ...(input.vertical === "CLINIC"
          ? STARTER_MEDICINES.map(({ name, ...rest }) => ({ orgId: org.id, kind: "MEDICINE" as const, name, data: rest }))
          : []),
      ],
    });
    return org;
  });
}
