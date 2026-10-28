import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { optStr, str } from "@/lib/form";
import { normalizePhone } from "@/lib/phone";
import { istDate, parseDateInput } from "@/lib/time";
import type { Ctx } from "./auth";

/** Parse the shared contact form (create and edit). Throws a user-facing Error when invalid. */
export function parseContactForm(ctx: Ctx, form: FormData) {
  const name = str(form, "name");
  if (name.length < 2) throw new Error("Please enter the full name.");
  const phone = normalizePhone(str(form, "phone"));
  if (!phone) throw new Error("Please enter a valid 10-digit mobile number.");

  let dob = parseDateInput(str(form, "dob"));
  const age = Number.parseInt(str(form, "age"), 10);
  if (!dob && Number.isInteger(age) && age >= 0 && age < 120) {
    // Practices often record age, not date of birth; keep an approximate DOB so age stays current.
    const today = istDate();
    dob = new Date(Date.UTC(today.getUTCFullYear() - age, today.getUTCMonth(), today.getUTCDate()));
  }

  const fields: Record<string, string> = {};
  for (const f of ctx.pack.contactFields) {
    const v = str(form, `f_${f.key}`);
    if (v) fields[f.key] = v.slice(0, 300);
  }

  const optIn = form.get("whatsappOptIn") === "on";
  const gender = optStr(form, "gender");
  return {
    name: name.slice(0, 120),
    phone,
    email: optStr(form, "email"),
    gender: gender && ["M", "F", "O"].includes(gender) ? gender : null,
    dob,
    address: optStr(form, "address"),
    preferredLang: str(form, "preferredLang") === "hi" ? "hi" : "en",
    whatsappOptIn: optIn,
    fields: fields as Prisma.InputJsonValue,
  };
}

export async function createContact(ctx: Ctx, form: FormData) {
  const data = parseContactForm(ctx, form);
  return db.contact.create({
    data: { ...data, orgId: ctx.org.id, consentAt: data.whatsappOptIn ? new Date() : null },
  });
}

export async function findContact(ctx: Ctx, id: string) {
  return db.contact.findFirst({ where: { id, orgId: ctx.org.id } });
}

/** Search by name or by any part of the phone number. */
export async function searchContacts(ctx: Ctx, q: string, take = 50) {
  const query = q.trim();
  const digits = query.replace(/\D/g, "");
  return db.contact.findMany({
    where: {
      orgId: ctx.org.id,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" as const } },
              ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}

/** Reuse the contact if this exact name + mobile is already registered, else create one. */
export async function findOrCreateContact(ctx: Ctx, form: FormData) {
  const phone = normalizePhone(str(form, "phone"));
  const name = str(form, "name");
  const existing =
    phone && name
      ? await db.contact.findFirst({ where: { orgId: ctx.org.id, phone, name: { equals: name, mode: "insensitive" } } })
      : null;
  return existing ?? createContact(ctx, form);
}
