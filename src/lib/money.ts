// Money is stored as integer paise everywhere.

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function formatMoney(paise: number): string {
  const text = inr.format(paise / 100);
  return paise % 100 === 0 ? text.replace(/\.00$/, "") : text;
}

/** Parse a rupee amount typed by a user ("500", "1,250.50") into paise. */
export function rupeesToPaise(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(String(value).replace(/[,₹\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function paiseToRupees(paise: number): string {
  return (paise / 100).toFixed(paise % 100 === 0 ? 0 : 2);
}
