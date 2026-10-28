/** Read a trimmed string field from FormData ("" when missing). */
export function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export function optStr(form: FormData, key: string): string | null {
  const v = str(form, key);
  return v === "" ? null : v;
}

export function int(form: FormData, key: string, fallback = 0): number {
  const n = Number.parseInt(str(form, key), 10);
  return Number.isFinite(n) ? n : fallback;
}
