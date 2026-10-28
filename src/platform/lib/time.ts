// All practices are in India, so "today" always means today in IST.
// Calendar dates (Postgres DATE columns) are represented as UTC midnight.

export const TIME_ZONE = "Asia/Kolkata";
const IST_OFFSET_MS = 330 * 60 * 1000;

/** The IST calendar date of `at`, as a UTC-midnight Date (for @db.Date columns). */
export function istDate(at: Date = new Date()): Date {
  const shifted = new Date(at.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}

/** The instant range [start, end) covering the IST day of `date` (a UTC-midnight date). */
export function istDayRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getTime() - IST_OFFSET_MS);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Parse "YYYY-MM-DD" into a UTC-midnight Date, or null. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse "YYYY-MM-DD" + "HH:MM" entered in IST into an instant. */
export function parseIstDateTime(date: string, time: string): Date | null {
  const day = parseDateInput(date);
  if (!day || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [h, m] = time.split(":").map(Number);
  return new Date(day.getTime() - IST_OFFSET_MS + (h * 60 + m) * 60 * 1000);
}

export function toDateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDate(date: Date | null | undefined): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function formatTime(at: Date): string {
  return at.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });
}

export function formatDateTime(at: Date): string {
  return at.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  });
}

export function ageFrom(dob: Date | null | undefined, today: Date = istDate()): number | null {
  if (!dob) return null;
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const beforeBirthday =
    today.getUTCMonth() < dob.getUTCMonth() ||
    (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
  if (beforeBirthday) age--;
  return age;
}
