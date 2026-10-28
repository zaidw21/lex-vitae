import { describe, expect, it } from "vitest";
import { canTransition } from "@/core/queue";
import { computeTotals, statusFor } from "@/core/billing";
import { renderTemplate, messageText } from "@/core/templates";
import { formatMoney, rupeesToPaise } from "@/lib/money";
import { normalizePhone } from "@/lib/phone";
import { ageFrom, istDate, istDayRange, parseIstDateTime } from "@/lib/time";
import { PACKS } from "@/verticals";
import { describeFrequency, instruction, sanitizeRxItems } from "@/verticals/clinic/rx";

describe("phone", () => {
  it("normalizes Indian mobiles in common formats", () => {
    expect(normalizePhone("98260 12345")).toBe("+919826012345");
    expect(normalizePhone("+91-98260-12345")).toBe("+919826012345");
    expect(normalizePhone("09826012345")).toBe("+919826012345");
    expect(normalizePhone("919826012345")).toBe("+919826012345");
  });
  it("rejects landlines and junk", () => {
    expect(normalizePhone("011 2345 678")).toBeNull();
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("money", () => {
  it("parses rupees into paise", () => {
    expect(rupeesToPaise("1,250.50")).toBe(125050);
    expect(rupeesToPaise("₹400")).toBe(40000);
    expect(rupeesToPaise("-5")).toBe(0);
    expect(rupeesToPaise("abc")).toBe(0);
  });
  it("formats with Indian grouping", () => {
    expect(formatMoney(12345600)).toBe("₹1,23,456");
    expect(formatMoney(12345)).toBe("₹123.45");
  });
});

describe("IST time", () => {
  it("rolls over to the next date at IST midnight, not UTC midnight", () => {
    // 2026-03-10 19:00 UTC is 2026-03-11 00:30 IST.
    expect(istDate(new Date("2026-03-10T19:00:00Z")).toISOString()).toBe("2026-03-11T00:00:00.000Z");
    expect(istDate(new Date("2026-03-10T18:00:00Z")).toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });
  it("gives the instant range of an IST day", () => {
    const { start, end } = istDayRange(new Date("2026-03-11T00:00:00Z"));
    expect(start.toISOString()).toBe("2026-03-10T18:30:00.000Z");
    expect(end.toISOString()).toBe("2026-03-11T18:30:00.000Z");
  });
  it("parses IST date + time inputs", () => {
    expect(parseIstDateTime("2026-03-11", "10:00")?.toISOString()).toBe("2026-03-11T04:30:00.000Z");
    expect(parseIstDateTime("2026-03-11", "bad")).toBeNull();
  });
  it("computes age with birthdays", () => {
    const today = new Date("2026-03-11T00:00:00Z");
    expect(ageFrom(new Date("2000-03-11T00:00:00Z"), today)).toBe(26);
    expect(ageFrom(new Date("2000-03-12T00:00:00Z"), today)).toBe(25);
  });
});

describe("billing", () => {
  it("totals lines and clamps the discount", () => {
    const items = [{ description: "Consultation", qty: 1, unitPrice: 40000 }, { description: "ECG", qty: 2, unitPrice: 30000 }];
    expect(computeTotals(items, 10000)).toEqual({ subtotal: 100000, discount: 10000, total: 90000 });
    expect(computeTotals(items, 500000)).toEqual({ subtotal: 100000, discount: 100000, total: 0 });
    expect(computeTotals(items, -5)).toEqual({ subtotal: 100000, discount: 0, total: 100000 });
  });
  it("derives status from payments", () => {
    expect(statusFor(1000, 0)).toBe("UNPAID");
    expect(statusFor(1000, 500)).toBe("PARTIAL");
    expect(statusFor(1000, 1000)).toBe("PAID");
    expect(statusFor(0, 0)).toBe("PAID");
  });
});

describe("queue transitions", () => {
  it("allows the normal flow and recall", () => {
    expect(canTransition("WAITING", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "DONE")).toBe(true);
    expect(canTransition("SKIPPED", "WAITING")).toBe(true);
  });
  it("blocks reopening a finished consultation", () => {
    expect(canTransition("DONE", "WAITING")).toBe(false);
    expect(canTransition("WAITING", "DONE")).toBe(false);
  });
});

describe("prescriptions", () => {
  it("explains dosing in Hindi and English", () => {
    expect(describeFrequency("1-0-1", "en")).toBe("1 in the morning, 1 at night");
    expect(describeFrequency("1-0-1", "hi")).toBe("सुबह 1, रात 1");
    expect(describeFrequency("SOS", "hi")).toBe("ज़रूरत पड़ने पर");
    expect(instruction({ name: "Tab. X", frequency: "0-0-1", timing: "AFTER_FOOD", days: 5 }, "hi")).toBe("रात 1 · खाने के बाद · 5 दिन तक");
  });
  it("sanitizes untrusted items", () => {
    const items = sanitizeRxItems([{ name: "  Tab. Y  ", timing: "NOPE", days: 9999 }, { name: "" }, null, "x"]);
    expect(items).toEqual([{ name: "Tab. Y", dose: undefined, frequency: "1-0-1", timing: "AFTER_FOOD", days: undefined, note: undefined }]);
    expect(sanitizeRxItems("not an array")).toEqual([]);
  });
});

describe("vertical packs", () => {
  it("render every template in both languages without leftover placeholders", () => {
    for (const pack of Object.values(PACKS)) {
      for (const [key, langs] of Object.entries(pack.messages)) {
        for (const lang of ["en", "hi"] as const) {
          const vars = Object.fromEntries([...langs![lang].matchAll(/\{\{(\w+)\}\}/g)].map((m) => [m[1], "X"]));
          const text = messageText(pack, key as never, lang, vars)!;
          expect(text, `${pack.id}.${key}.${lang}`).not.toMatch(/\{\{/);
        }
      }
    }
  });
  it("leaves unknown variables empty", () => {
    expect(renderTemplate("Hi {{name}}{{missing}}", { name: "Asha" })).toBe("Hi Asha");
  });
  it("every pack includes the shared core modules", () => {
    for (const pack of Object.values(PACKS)) {
      for (const m of ["dashboard", "contacts", "billing", "messages", "settings"] as const) expect(pack.modules).toContain(m);
    }
  });
});
