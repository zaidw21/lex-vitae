"use client";

import { useState } from "react";
import { FREQUENCIES, TIMINGS, instruction, type RxItem, type RxTiming } from "@/apps/clinic/rx";

export function RxEditor({ favourites, previous }: { favourites: RxItem[]; previous: RxItem[] }) {
  const [items, setItems] = useState<RxItem[]>([]);
  const [search, setSearch] = useState("");

  const add = (item: RxItem) => setItems((xs) => [...xs, { ...item }]);
  const update = (i: number, patch: Partial<RxItem>) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = (i: number) => setItems((xs) => xs.filter((_, j) => j !== i));

  const addFromSearch = () => {
    const name = search.trim();
    if (!name) return;
    const fav = favourites.find((f) => f.name.toLowerCase() === name.toLowerCase());
    add(fav ?? { name, frequency: "1-0-1", timing: "AFTER_FOOD", days: 5 });
    setSearch("");
  };

  return (
    <div>
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <div className="flex flex-wrap gap-2">
        <input
          list="rx-favourites"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addFromSearch();
            }
          }}
          placeholder="Type a medicine and press Enter"
          className="input min-w-0 flex-1"
          aria-label="Add medicine"
        />
        <datalist id="rx-favourites">
          {favourites.map((f) => (
            <option key={f.name} value={f.name} />
          ))}
        </datalist>
        <button type="button" onClick={addFromSearch} className="btn-secondary">Add</button>
        {previous.length > 0 && (
          <button type="button" onClick={() => setItems(previous.map((p) => ({ ...p })))} className="btn-secondary">
            ↻ Repeat last Rx ({previous.length})
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {favourites.slice(0, 12).map((f) => (
          <button key={f.name} type="button" onClick={() => add(f)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 hover:border-brand-500 hover:bg-brand-50">
            + {f.name}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <ol className="mt-4 space-y-3">
          {items.map((item, i) => (
            <li key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <input value={item.name} onChange={(e) => update(i, { name: e.target.value })} className="input font-medium" aria-label="Medicine name" />
                <button type="button" onClick={() => remove(i)} className="btn-ghost btn-sm" aria-label={`Remove ${item.name}`}>✕</button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <input value={item.dose ?? ""} onChange={(e) => update(i, { dose: e.target.value })} placeholder="Dose" className="input" aria-label="Dose" />
                <select value={item.frequency} onChange={(e) => update(i, { frequency: e.target.value })} className="input" aria-label="Frequency">
                  {FREQUENCIES.map((f) => <option key={f}>{f}</option>)}
                </select>
                <select value={item.timing} onChange={(e) => update(i, { timing: e.target.value as RxTiming })} className="input" aria-label="When">
                  {TIMINGS.map((t) => <option key={t.value} value={t.value}>{t.en}</option>)}
                </select>
                <input type="number" min={1} max={365} value={item.days ?? ""} onChange={(e) => update(i, { days: e.target.value ? Number(e.target.value) : undefined })} placeholder="Days" className="input" aria-label="Days" />
                <input value={item.note ?? ""} onChange={(e) => update(i, { note: e.target.value })} placeholder="Note" className="input col-span-2 sm:col-span-1" aria-label="Note" />
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {instruction(item, "en")} <span className="mx-1">·</span> <span lang="hi">{instruction(item, "hi")}</span>
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
