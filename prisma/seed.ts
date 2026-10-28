// Demo data: one clinic and one law chamber, both owned by demo@example.com / demo1234.
// Re-running wipes the demo organizations and recreates them relative to today.

import bcrypt from "bcryptjs";
import { PrismaClient, type PaymentMode, type Prisma } from "@prisma/client";
import { provisionOrganization } from "../src/platform/services/provision";
import { publicCode } from "../src/platform/lib/ids";
import { addDays, istDate, istDayRange } from "../src/platform/lib/time";
import { clinicConfig } from "../src/apps/clinic/config";
import { STARTER_MEDICINES } from "../src/apps/clinic/rx";
import { legalConfig } from "../src/apps/legal/config";

const db = new PrismaClient();

let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const between = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));

const FIRST_F = ["Sunita", "Priya", "Kavita", "Neha", "Pooja", "Anjali", "Rekha", "Meena", "Shweta", "Ritu", "Aarti", "Nazia", "Farah", "Simran", "Divya"];
const FIRST_M = ["Rajesh", "Amit", "Suresh", "Vikas", "Rahul", "Manoj", "Sanjay", "Arjun", "Imran", "Deepak", "Rohit", "Anil", "Harish", "Gurpreet", "Mohit"];
const LAST = ["Sharma", "Verma", "Jain", "Patel", "Gupta", "Yadav", "Malviya", "Chouhan", "Khan", "Agrawal", "Tiwari", "Dubey", "Rathore", "Soni", "Singh"];
const AREAS = ["Vijay Nagar", "Palasia", "Rajwada", "Bhawarkua", "Sudama Nagar", "MR 10", "Rau", "Annapurna"];

const CASES = [
  { complaints: "Fever x 3 days, body ache", diagnosis: "Acute viral fever", meds: [0, 5], advice: "Plenty of fluids. CBC if fever persists beyond 3 days." },
  { complaints: "Acidity, burning in chest after meals", diagnosis: "GERD", meds: [1], advice: "Avoid spicy food and late dinners." },
  { complaints: "Sneezing, running nose", diagnosis: "Allergic rhinitis", meds: [2], advice: "Avoid dust; steam inhalation." },
  { complaints: "Sore throat, cough", diagnosis: "Acute pharyngitis", meds: [3, 0, 5], advice: "Warm saline gargles." },
  { complaints: "Loose motions x 2 days", diagnosis: "Acute gastroenteritis", meds: [6, 9], advice: "ORS after every loose stool. Light diet." },
  { complaints: "Routine sugar check", diagnosis: "Type 2 diabetes mellitus, follow-up", meds: [7], advice: "Walk 30 min daily. FBS/PPBS next visit." },
  { complaints: "Headache, BP check", diagnosis: "Essential hypertension", meds: [8], advice: "Low salt diet. Monitor BP at home." },
];

async function main() {
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const demoUsers = ["demo@example.com", "reception@example.com"];
  const existing = await db.membership.findMany({ where: { user: { email: { in: demoUsers } } }, select: { orgId: true } });
  await db.organization.deleteMany({ where: { id: { in: existing.map((m) => m.orgId) } } });
  await db.user.deleteMany({ where: { email: { in: demoUsers } } });

  const doctor = await db.user.create({ data: { email: "demo@example.com", name: "Dr. Anil Sharma", phone: "+919826012345", passwordHash } });
  const reception = await db.user.create({ data: { email: "reception@example.com", name: "Kiran (Reception)", passwordHash } });

  await seedClinic(doctor.id, reception.id);
  await seedLegal(doctor.id);
  console.log("Seeded. Log in with demo@example.com / demo1234 (owner) or reception@example.com / demo1234 (front desk).");
}

function person() {
  const female = rand() < 0.5;
  const name = `${pick(female ? FIRST_F : FIRST_M)} ${pick(LAST)}`;
  const phone = `+91${pick(["98", "97", "94", "88", "70", "62"])}${String(between(10000000, 99999999))}`;
  return { name, phone, gender: female ? "F" : "M" };
}

async function seedClinic(doctorId: string, receptionId: string) {
  const owner = await db.user.findUniqueOrThrow({ where: { id: doctorId } });
  const org = await provisionOrganization({ name: "Sharma Family Clinic", city: "Indore", phone: "+917312345678", app: clinicConfig, owner });
  await db.organization.update({
    where: { id: org.id },
    data: { address: "12, Saket Nagar, Indore, MP 452018", settings: { consultationFee: 400, followUpFee: 0, followUpFreeDays: 7, queueAvgMinutes: 7 } },
  });
  const ownerMembership = await db.membership.update({
    where: { orgId_userId: { orgId: org.id, userId: doctorId } },
    data: { qualifications: "MBBS, MD (General Medicine)", registrationNo: "MPMC-23871" },
  });
  await db.membership.create({ data: { orgId: org.id, userId: receptionId, role: "STAFF" } });

  const today = istDate();
  const patients = [];
  for (let i = 0; i < 70; i++) {
    const p = person();
    const age = between(3, 78);
    patients.push(
      await db.contact.create({
        data: {
          orgId: org.id,
          ...p,
          dob: new Date(Date.UTC(today.getUTCFullYear() - age, between(0, 11), between(1, 28))),
          address: pick(AREAS) + ", Indore",
          preferredLang: rand() < 0.7 ? "hi" : "en",
          consentAt: addDays(new Date(), -between(20, 200)),
          fields: rand() < 0.15 ? { allergies: "Penicillin" } : rand() < 0.2 ? { conditions: pick(["Diabetes", "Hypertension", "Asthma"]) } : {},
          createdAt: addDays(new Date(), -between(20, 200)),
        },
      }),
    );
  }

  let invoiceNo = 0;
  const doctorSnapshot = { name: owner.name, qualifications: ownerMembership.qualifications, registrationNo: ownerMembership.registrationNo };

  // History: the last 21 days of OPD, plus a busy morning today.
  for (let dayOffset = 21; dayOffset >= 0; dayOffset--) {
    const date = addDays(today, -dayOffset);
    if (date.getUTCDay() === 0 && dayOffset !== 0) continue; // closed on Sundays
    const { start } = istDayRange(date);
    const count = dayOffset === 0 ? 9 : between(14, 28);
    for (let token = 1; token <= count; token++) {
      const patient = pick(patients);
      const eveningShift = token > count * 0.6;
      const checkIn =
        dayOffset === 0
          ? new Date(Date.now() - (count - token + 1) * 9 * 60_000) // today's patients arrived over the last ~90 min
          : new Date(start.getTime() + ((eveningShift ? 17.5 : 10) * 60 + (eveningShift ? token - count * 0.6 : token) * 8) * 60_000);
      let status: "DONE" | "IN_PROGRESS" | "WAITING" = "DONE";
      if (dayOffset === 0) status = token <= 3 ? "DONE" : token === 4 ? "IN_PROGRESS" : "WAITING";
      const startedAt = status === "WAITING" ? null : new Date(Math.min(checkIn.getTime() + between(5, 40) * 60_000, Date.now() - 60_000));
      const completedAt = status === "DONE" && startedAt ? new Date(Math.min(startedAt.getTime() + between(4, 11) * 60_000, Date.now())) : null;
      const entry = await db.queueEntry.create({
        data: { orgId: org.id, date, tokenNumber: token, contactId: patient.id, providerId: ownerMembership.id, status, publicCode: publicCode(), checkedInAt: checkIn, startedAt, completedAt },
      });
      if (status !== "DONE") continue;

      const c = pick(CASES);
      const items = c.meds.map((m) => STARTER_MEDICINES[m]);
      const followUpOn = rand() < 0.35 ? addDays(date, pick([3, 5, 7, 15])) : null;
      const clinical = {
        vitals: { bp: `${between(110, 150)}/${between(70, 95)}`, pulse: String(between(68, 102)), temp: c.diagnosis.includes("fever") ? "100.4" : "98.6", spo2: String(between(96, 99)), weight: String(between(14, 92)) },
        complaints: c.complaints,
        findings: "",
        diagnosis: c.diagnosis,
        advice: c.advice,
      };
      const encounter = await db.encounter.create({
        data: { orgId: org.id, contactId: patient.id, providerId: ownerMembership.id, queueEntryId: entry.id, kind: "CONSULTATION", occurredAt: completedAt!, summary: c.diagnosis, data: clinical, followUpOn },
      });
      await db.document.create({
        data: {
          orgId: org.id, contactId: patient.id, encounterId: encounter.id, type: "PRESCRIPTION", title: "Prescription",
          data: { ...clinical, items, followUpOn: followUpOn?.toISOString() ?? null, issuedBy: doctorSnapshot } as Prisma.InputJsonValue,
          publicCode: publicCode(), createdById: doctorId, createdAt: completedAt!,
        },
      });
      if (followUpOn) {
        await db.task.create({
          data: { orgId: org.id, contactId: patient.id, kind: "FOLLOW_UP", title: "Follow-up visit", dueOn: followUpOn, status: followUpOn < today ? pick(["DONE", "DONE", "OPEN"] as const) : "OPEN", createdAt: completedAt! },
        });
      }
      const fee = rand() < 0.12 ? 0 : 40000;
      const extra = rand() < 0.15 ? pick([["Nebulization", 20000], ["Injection (administration)", 10000], ["ECG", 30000]] as const) : null;
      const lines = [{ description: fee ? "Consultation" : "Follow-up consultation (free)", qty: 1, unitPrice: fee }, ...(extra ? [{ description: extra[0], qty: 1, unitPrice: extra[1] }] : [])];
      const total = lines.reduce((s, l) => s + l.unitPrice, 0);
      const unpaid = rand() < 0.06;
      const mode: PaymentMode = rand() < 0.55 ? "CASH" : rand() < 0.9 ? "UPI" : "CARD";
      invoiceNo++;
      const invoice = await db.invoice.create({
        data: {
          orgId: org.id, number: invoiceNo, contactId: patient.id, encounterId: encounter.id, subtotal: total, total, paid: unpaid ? 0 : total,
          status: total === 0 ? "PAID" : unpaid ? "UNPAID" : "PAID", publicCode: publicCode(), createdById: receptionId, createdAt: completedAt!,
          items: { create: lines.map((l) => ({ ...l, amount: l.unitPrice })) },
        },
      });
      if (!unpaid && total > 0) {
        await db.payment.create({ data: { orgId: org.id, invoiceId: invoice.id, amount: total, mode, reference: mode === "UPI" ? `UPI${between(100000, 999999)}` : null, receivedById: receptionId, receivedAt: completedAt! } });
      }
      if (patient.whatsappOptIn) {
        await db.message.create({
          data: { orgId: org.id, contactId: patient.id, to: patient.phone, template: "DOCUMENT_SHARED", status: "SENT", provider: "log", createdAt: completedAt!,
            body: patient.preferredLang === "hi" ? `${patient.name}, ${org.name} से आपका पर्चा तैयार है।` : `${patient.name}, your prescription from ${org.name} is ready.` },
        });
      }
    }
  }
  await db.counter.create({ data: { orgId: org.id, key: "invoice", value: invoiceNo } });

  // Upcoming appointments.
  for (const [days, hour] of [[0, 18], [0, 18.5], [1, 10], [1, 10.25], [1, 11], [2, 17.5]] as const) {
    const { start } = istDayRange(addDays(today, days));
    await db.appointment.create({
      data: { orgId: org.id, contactId: pick(patients).id, providerId: ownerMembership.id, startsAt: new Date(start.getTime() + hour * 3600_000), source: pick(["PHONE", "WHATSAPP"]), notes: pick(["Sugar review", "BP check", "Reports review", null]) },
    });
  }
}

async function seedLegal(ownerId: string) {
  const owner = await db.user.findUniqueOrThrow({ where: { id: ownerId } });
  const org = await provisionOrganization({ name: "Verma & Associates", city: "Indore", phone: "+917314567890", app: legalConfig, owner });
  await db.organization.update({ where: { id: org.id }, data: { address: "Chamber 214, District Court Complex, Indore" } });
  const membership = await db.membership.update({
    where: { orgId_userId: { orgId: org.id, userId: ownerId } },
    data: { qualifications: "B.A. LL.B., Advocate", registrationNo: "MP/1432/2009" },
  });
  const today = istDate();
  const courts = ["District Court, Indore", "Family Court, Indore", "MP High Court, Indore Bench", "Consumer Forum, Indore"];
  const types = ["Civil suit", "Bail application", "Family / matrimonial", "Cheque bounce (NI Act 138)", "Consumer complaint", "Property / revenue"];
  const stages = ["Notice / service", "Appearance", "Written statement / reply", "Evidence", "Arguments"];
  let invoiceNo = 0;

  for (let i = 0; i < 24; i++) {
    const p = person();
    const client = await db.contact.create({
      data: { orgId: org.id, ...p, preferredLang: rand() < 0.6 ? "hi" : "en", consentAt: new Date(), fields: { occupation: pick(["Business", "Service", "Farmer", "Retired", "Homemaker"]) } },
    });
    const caseType = pick(types);
    const nextHearingOn = i < 5 ? today : i < 8 ? addDays(today, -between(2, 20)) : addDays(today, between(1, 45));
    const matter = await db.matter.create({
      data: {
        orgId: org.id, contactId: client.id,
        title: `${client.name} vs. ${pick(["State of MP", `${pick(FIRST_M)} ${pick(LAST)}`, "ICICI Lombard", `${pick(FIRST_F)} ${pick(LAST)}`])}`,
        caseNumber: `${pick(["CS", "MJC", "RCS", "CC", "BA"])}/${between(100, 999)}/${today.getUTCFullYear() - between(0, 2)}`,
        cnr: `MPIN01${String(between(1000000, 9999999)).padStart(7, "0")}${today.getUTCFullYear()}`,
        court: pick(courts), caseType, stage: pick(stages), nextHearingOn, oppositeParty: pick(["State", "Respondent", "Insurance company"]),
      },
    });
    for (let h = between(1, 4); h > 0; h--) {
      const heldOn = addDays(today, -h * between(20, 40));
      await db.encounter.create({
        data: {
          orgId: org.id, contactId: client.id, providerId: membership.id, refType: "matter", refId: matter.id, kind: "HEARING", occurredAt: heldOn,
          summary: pick(["Adjourned at request of opposite counsel.", "Reply filed; matter fixed for evidence.", "Arguments heard in part.", "Witness PW-1 examined."]),
          data: { purpose: pick(stages), outcome: pick(["Adjourned at request of opposite counsel.", "Reply filed; matter fixed for evidence.", "Arguments heard in part.", "Witness PW-1 examined."]) },
        },
      });
    }
    invoiceNo++;
    const total = pick([500000, 1000000, 1500000, 2500000]);
    const paid = pick([total, total / 2, 0]);
    const createdAt = addDays(new Date(), -between(1, 60));
    const invoice = await db.invoice.create({
      data: {
        orgId: org.id, number: invoiceNo, contactId: client.id, refType: "matter", refId: matter.id, subtotal: total, total, paid,
        status: paid === total ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID", publicCode: publicCode(), createdById: ownerId, createdAt,
        items: { create: [{ description: "Professional fees", qty: 1, unitPrice: total, amount: total }] },
      },
    });
    if (paid > 0) await db.payment.create({ data: { orgId: org.id, invoiceId: invoice.id, amount: paid, mode: pick(["UPI", "BANK", "CASH"] as const), receivedById: ownerId, receivedAt: createdAt } });
  }
  await db.counter.create({ data: { orgId: org.id, key: "invoice", value: invoiceNo } });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
