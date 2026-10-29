// The API sends instants ("2026-10-29T03:41:33Z") and calendar days ("2026-10-29"). Everything is shown
// in IST, because all practices are in India.

export const TIME_ZONE = "Asia/Kolkata";
const DAY = /^\d{4}-\d{2}-\d{2}$/;

function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return DAY.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
}

/** Today's IST calendar day as "YYYY-MM-DD". */
export function todayIst(): string {
  return new Date(Date.now() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

/** Add days to a "YYYY-MM-DD" day. */
export function addDays(day: string, days: number): string {
  return new Date(toDate(day).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

export function isDay(value: string | null | undefined): value is string {
  return !!value && DAY.test(value);
}

/** "29 Oct 2026". Calendar days are shown as-is; instants are shown in IST. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const isCalendarDay = typeof value === "string" && DAY.test(value);
  return toDate(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: isCalendarDay ? "UTC" : TIME_ZONE });
}

export function formatTime(value: string | Date): string {
  return toDate(value).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });
}

export function formatDateTime(value: string | Date): string {
  return toDate(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: TIME_ZONE });
}

/** "Wed 29" for a calendar day. */
export function formatWeekday(day: string): string {
  return toDate(day).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", timeZone: "UTC" });
}

