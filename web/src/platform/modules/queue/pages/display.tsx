import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/platform/ui/auto-refresh";
import { api, ApiError } from "@/platform/api/client";
import type { Display } from "../types";

export const metadata: Metadata = { title: "Queue display", robots: { index: false } };

/** Waiting-room TV. Shows token numbers only, never names. */
export default async function DisplayPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = encodeURIComponent((await params).slug);
  const board = await api.public<Display>(`/api/public/display/${slug}`).catch((err) => {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  });
  const serving = board.serving;
  const waiting = board.waiting;

  return (
    <main className="flex min-h-screen flex-col bg-slate-900 p-8 text-white">
      <AutoRefresh seconds={5} />
      <h1 className="text-center text-3xl font-semibold text-white">{board.orgName}</h1>
      <div className="mt-8 grid flex-1 gap-8 lg:grid-cols-2">
        <section className="flex flex-col items-center justify-center rounded-3xl bg-brand-700 p-8">
          <div className="text-2xl uppercase tracking-widest text-brand-100">Now serving · अभी</div>
          <div className="mt-4 text-[10rem] font-bold leading-none">
            {serving.length ? serving.join(", ") : "—"}
          </div>
        </section>
        <section className="rounded-3xl bg-slate-800 p-8">
          <div className="text-2xl uppercase tracking-widest text-slate-300">Next · अगला</div>
          <div className="mt-6 flex flex-wrap gap-4">
            {waiting.slice(0, 12).map((token, i) => (
              <div key={token} className={`grid h-24 w-24 place-items-center rounded-2xl text-4xl font-bold ${i === 0 ? "bg-amber-400 text-slate-900" : "bg-slate-700"}`}>
                {token}
              </div>
            ))}
            {waiting.length === 0 && <div className="text-xl text-slate-400">No one waiting</div>}
          </div>
        </section>
      </div>
      <p className="mt-6 text-center text-slate-400">Track your turn on WhatsApp · अपनी बारी WhatsApp पर देखें</p>
    </main>
  );
}
