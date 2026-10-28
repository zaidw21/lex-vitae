import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/platform/ui/auto-refresh";
import { averageMinutes, peopleAhead, queueSettings } from "@/platform/modules/queue/service";
import { db } from "@/platform/lib/db";
import { formatTime, istDate } from "@/platform/lib/time";

export const metadata: Metadata = { title: "Your token", robots: { index: false } };

export default async function TokenStatusPage({ params }: { params: Promise<{ code: string }> }) {
  const entry = await db.queueEntry.findUnique({ where: { publicCode: (await params).code }, include: { org: true, contact: true } });
  if (!entry) notFound();
  const isToday = entry.date.getTime() === istDate().getTime();
  const hi = entry.contact.preferredLang === "hi";
  const ahead = await peopleAhead(entry);
  const avg = await averageMinutes(entry.orgId, entry.date, queueSettings(entry.org).avgMinutes);
  const nowServing = await db.queueEntry.findFirst({
    where: { orgId: entry.orgId, date: entry.date, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });

  let headline: string;
  let detail: string;
  if (!isToday) {
    headline = hi ? "यह टोकन पुराना है" : "This token has expired";
    detail = "";
  } else if (entry.status === "WAITING") {
    headline = ahead === 0 ? (hi ? "आप अगले हैं!" : "You're next!") : hi ? `आपसे पहले ${ahead} लोग` : `${ahead} ${ahead === 1 ? "person" : "people"} ahead of you`;
    detail = ahead === 0 ? (hi ? "कृपया पास ही रहें।" : "Please stay close by.") : hi ? `अनुमानित इंतज़ार ~${ahead * avg} मिनट` : `Estimated wait ~${ahead * avg} min`;
  } else if (entry.status === "IN_PROGRESS") {
    headline = hi ? "कृपया अंदर आएँ" : "Please go in now";
    detail = hi ? "आपकी बारी है।" : "It's your turn.";
  } else if (entry.status === "DONE") {
    headline = hi ? "पूरा हुआ" : "All done";
    detail = hi ? "आने के लिए धन्यवाद!" : "Thank you for visiting!";
  } else if (entry.status === "SKIPPED") {
    headline = hi ? "आपका नंबर निकल गया" : "Your turn was missed";
    detail = hi ? "कृपया रिसेप्शन पर बताएँ।" : "Please inform the reception.";
  } else {
    headline = hi ? "टोकन रद्द" : "Token cancelled";
    detail = "";
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4">
      <AutoRefresh seconds={15} />
      <div className="w-full max-w-sm text-center">
        <div className="text-sm font-semibold text-slate-600">{entry.org.name}</div>
        <div className="mt-6 text-xs uppercase tracking-widest text-slate-500">{hi ? "आपका टोकन" : "Your token"}</div>
        <div className="text-8xl font-bold text-brand-700">{entry.tokenNumber}</div>
        <div className="card mt-6 p-5">
          <div className="text-xl font-semibold">{headline}</div>
          {detail && <div className="mt-1 text-slate-600">{detail}</div>}
          {isToday && nowServing && entry.status === "WAITING" && (
            <div className="mt-4 text-sm text-slate-500">{hi ? "अभी चल रहा है" : "Now serving"}: <b>#{nowServing.tokenNumber}</b></div>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-400">
          {hi ? "यह पेज अपने-आप अपडेट होता है" : "This page updates automatically"} · {formatTime(new Date())}
        </p>
      </div>
    </main>
  );
}
