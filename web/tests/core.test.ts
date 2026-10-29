import { describe, expect, it } from "vitest";
import { qs } from "@/platform/api/client";
import { formatMoney, paiseToRupees, rupeesToPaise } from "@/platform/lib/money";
import { normalizePhone } from "@/platform/lib/phone";
import { addDays, formatDate, isDay } from "@/platform/lib/time";
import { MODULES } from "@/platform/kernel/modules";
import { APP_UI } from "@/registry";
import { describeFrequency, instruction, sanitizeRxItems } from "@/apps/clinic/rx";

// Business rules (billing totals, queue transitions, templates, tenant isolation) live in the Java API and
// are tested there. These cover what the web client still does itself: input parsing and display.

describe("phone", () => {
  it("normalizes Indian mobiles in common formats", () => {
    expect(normalizePhone("98260 12345")).toBe("+919826012345");
    expect(normalizePhone("+91-98260-12345")).toBe("+919826012345");
    expect(normalizePhone("09826012345")).toBe("+919826012345");
  });
  it("rejects landlines and junk", () => {
    expect(normalizePhone("011 2345 678")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("money", () => {
  it("parses rupees into paise", () => {
    expect(rupeesToPaise("1,250.50")).toBe(125050);
    expect(rupeesToPaise("₹400")).toBe(40000);
    expect(rupeesToPaise("abc")).toBe(0);
  });
  it("formats with Indian grouping", () => {
    expect(formatMoney(12345600)).toBe("₹1,23,456");
    expect(formatMoney(12345)).toBe("₹123.45");
    expect(paiseToRupees(12345)).toBe("123.45");
  });
});

describe("dates from the API", () => {
  it("shows calendar days as-is and instants in IST", () => {
    expect(formatDate("2026-03-11")).toBe("11 Mar 2026");
    // 2026-03-10 19:00 UTC is 2026-03-11 00:30 IST.
    expect(formatDate("2026-03-10T19:00:00Z")).toBe("11 Mar 2026");
  });
  it("does calendar arithmetic on day strings", () => {
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(isDay("2026-03-11")).toBe(true);
    expect(isDay("11/03/2026")).toBe(false);
  });
});

describe("api client", () => {
  it("builds query strings and drops empty values", () => {
    expect(qs({ q: "ram kumar", page: 2, empty: "", none: null, missing: undefined })).toBe("?q=ram+kumar&page=2");
    expect(qs({})).toBe("");
  });
});

describe("prescriptions", () => {
  it("explains dosing in Hindi and English", () => {
    expect(describeFrequency("1-0-1", "en")).toBe("1 in the morning, 1 at night");
    expect(describeFrequency("1-0-1", "hi")).toBe("सुबह 1, रात 1");
    expect(describeFrequency("SOS", "hi")).toBe("ज़रूरत पड़ने पर");
  });
  it("sanitizes stored items before rendering", () => {
    const items = sanitizeRxItems([{ name: " Paracetamol 650 ", frequency: "1-0-1", timing: "AFTER_FOOD", days: "5" }, { name: "" }, "junk"]);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Paracetamol 650");
    expect(instruction(items[0], "en")).toContain("5");
  });
});

describe("app UI registry", () => {
  it("only references modules the web client knows how to render", () => {
    expect(Object.keys(APP_UI).sort()).toEqual(["clinic", "legal"]);
    expect(Object.keys(MODULES).sort()).toEqual(["appointments", "queue"]);
  });
});
