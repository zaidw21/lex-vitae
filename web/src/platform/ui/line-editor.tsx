"use client";

import { useMemo, useState } from "react";

interface Line {
  description: string;
  qty: number;
  unitPrice: string; // rupees, as typed
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function LineEditor({ services, initial }: { services: { name: string; price: number }[]; initial: Line[] }) {
  const [lines, setLines] = useState<Line[]>(initial);
  const [discount, setDiscount] = useState("");
  const [paidNow, setPaidNow] = useState<string | null>(null);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.qty * (Number(l.unitPrice) || 0), 0), [lines]);
  const total = Math.max(0, subtotal - (Number(discount) || 0));
  const update = (i: number, patch: Partial<Line>) => setLines((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-4">
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="flex flex-wrap gap-1.5">
        {services.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => setLines((xs) => [...xs, { description: s.name, qty: 1, unitPrice: String(s.price / 100) }])}
            className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs hover:border-brand-500 hover:bg-brand-50"
          >
            + {s.name} {s.price > 0 && <span className="text-slate-500">{inr(s.price / 100)}</span>}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input value={l.description} onChange={(e) => update(i, { description: e.target.value })} placeholder="Item" className="input col-span-6" aria-label="Item" />
            <input type="number" min={1} value={l.qty} onChange={(e) => update(i, { qty: Number(e.target.value) || 1 })} className="input col-span-2" aria-label="Quantity" />
            <input type="number" min={0} step="0.01" value={l.unitPrice} onChange={(e) => update(i, { unitPrice: e.target.value })} placeholder="₹" className="input col-span-3" aria-label="Price" />
            <button type="button" onClick={() => setLines((xs) => xs.filter((_, j) => j !== i))} className="btn-ghost btn-sm col-span-1" aria-label="Remove">✕</button>
          </div>
        ))}
        <button type="button" onClick={() => setLines((xs) => [...xs, { description: "", qty: 1, unitPrice: "" }])} className="btn-ghost btn-sm">
          + Add line
        </button>
      </div>
      <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="discount">Discount (₹)</label>
          <input id="discount" name="discount" type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} className="input" />
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500">Subtotal {inr(subtotal)}</div>
          <div className="text-2xl font-semibold">{inr(total)}</div>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="paidNow">Received now (₹)</label>
          <input id="paidNow" name="paidNow" type="number" min={0} step="0.01" value={paidNow ?? String(total)} onChange={(e) => setPaidNow(e.target.value)} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="mode">Mode</label>
          <select id="mode" name="mode" className="input" defaultValue="CASH">
            <option value="CASH">Cash</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Card</option>
            <option value="BANK">Bank transfer</option>
            <option value="">Not paid yet</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="reference">UPI / txn ref</label>
          <input id="reference" name="reference" className="input" />
        </div>
      </div>
    </div>
  );
}
