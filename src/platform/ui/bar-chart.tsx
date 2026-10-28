/**
 * Single-series column chart, server-rendered. One hue (brand), thin columns with a 2px gap,
 * 4px rounded data-ends on the baseline, CSS hover tooltips, selective direct labels
 * (latest + peak) and a screen-reader table so values are never visual-only.
 */
export function BarChart({
  title,
  data,
  format = (n) => String(n),
}: {
  title: string;
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((best, d, i) => (d.value > data[best].value ? i : best), 0);
  const labelled = new Set([peak, data.length - 1]);

  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <div className="flex h-40 items-end gap-[2px] border-b border-slate-200 pt-6" aria-hidden>
        {data.map((d, i) => (
          <div key={d.label} className="group relative flex h-full flex-1 flex-col justify-end">
            {labelled.has(i) && d.value > 0 && (
              <span className="mb-1 text-center text-[10px] font-medium text-slate-600">{format(d.value)}</span>
            )}
            <div
              className="min-h-[2px] rounded-t-[4px] bg-brand-500 transition group-hover:bg-brand-700"
              style={{ height: `${(d.value / max) * 100}%` }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow group-hover:block">
              {d.label}: <b>{format(d.value)}</b>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500" aria-hidden>
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}><th scope="row">{d.label}</th><td>{format(d.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
