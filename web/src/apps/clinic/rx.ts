// Prescription line items and their bilingual instructions.

export type RxItem = {
  name: string;
  dose?: string; // "500 mg", "5 ml"
  frequency: string; // "1-0-1", "SOS", ...
  timing: RxTiming;
  days?: number;
  note?: string;
};

export type RxTiming = "AFTER_FOOD" | "BEFORE_FOOD" | "EMPTY_STOMACH" | "BEDTIME" | "ANY";

export const FREQUENCIES = ["1-0-1", "1-1-1", "1-0-0", "0-0-1", "0-1-0", "1-1-0", "0-1-1", "1-1-1-1", "SOS", "STAT", "Weekly"];

export const TIMINGS: { value: RxTiming; en: string; hi: string }[] = [
  { value: "AFTER_FOOD", en: "After food", hi: "खाने के बाद" },
  { value: "BEFORE_FOOD", en: "Before food", hi: "खाने से पहले" },
  { value: "EMPTY_STOMACH", en: "Empty stomach", hi: "खाली पेट" },
  { value: "BEDTIME", en: "At bedtime", hi: "सोते समय" },
  { value: "ANY", en: "Any time", hi: "कभी भी" },
];

const SLOT_NAMES_EN = ["morning", "afternoon", "night"];
const SLOT_NAMES_HI = ["सुबह", "दोपहर", "रात"];

/** Explain a frequency code in plain words: "1-0-1" → "1 in the morning, 1 at night". */
export function describeFrequency(code: string, lang: "en" | "hi"): string {
  if (code === "SOS") return lang === "hi" ? "ज़रूरत पड़ने पर" : "only when needed";
  if (code === "STAT") return lang === "hi" ? "तुरंत एक बार" : "once, immediately";
  if (code === "Weekly") return lang === "hi" ? "हफ़्ते में एक बार" : "once a week";
  if (code === "1-1-1-1") return lang === "hi" ? "दिन में 4 बार" : "4 times a day";
  const parts = code.split("-").map((p) => Number.parseFloat(p));
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return code;
  const names = lang === "hi" ? SLOT_NAMES_HI : SLOT_NAMES_EN;
  const slots = parts
    .map((qty, i) => (qty > 0 ? (lang === "hi" ? `${names[i]} ${qty}` : `${qty} in the ${names[i]}`) : null))
    .filter(Boolean);
  if (slots.length === 0) return code;
  return slots.join(lang === "hi" ? ", " : ", ").replace("in the night", "at night");
}

export function describeTiming(timing: RxTiming, lang: "en" | "hi"): string {
  const t = TIMINGS.find((x) => x.value === timing);
  return t ? t[lang] : "";
}

/** One-line patient-friendly instruction for an Rx item. */
export function instruction(item: RxItem, lang: "en" | "hi"): string {
  const parts = [describeFrequency(item.frequency, lang)];
  if (item.timing !== "ANY") parts.push(describeTiming(item.timing, lang));
  if (item.days) parts.push(lang === "hi" ? `${item.days} दिन तक` : `for ${item.days} day${item.days === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

/** Validate untrusted Rx items (from a form) into a clean list. */
export function sanitizeRxItems(input: unknown): RxItem[] {
  if (!Array.isArray(input)) return [];
  const timings = new Set(TIMINGS.map((t) => t.value));
  return input
    .map((raw): RxItem | null => {
      if (!raw || typeof raw !== "object") return null;
      const r = raw as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name.trim().slice(0, 120) : "";
      if (!name) return null;
      const days = Number(r.days);
      return {
        name,
        dose: typeof r.dose === "string" && r.dose.trim() ? r.dose.trim().slice(0, 40) : undefined,
        frequency: typeof r.frequency === "string" && r.frequency.trim() ? r.frequency.trim().slice(0, 20) : "1-0-1",
        timing: timings.has(r.timing as RxTiming) ? (r.timing as RxTiming) : "AFTER_FOOD",
        days: Number.isInteger(days) && days > 0 && days <= 365 ? days : undefined,
        note: typeof r.note === "string" && r.note.trim() ? r.note.trim().slice(0, 200) : undefined,
      };
    })
    .filter((x): x is RxItem => x !== null)
    .slice(0, 30);
}

