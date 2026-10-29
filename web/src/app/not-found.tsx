import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="text-slate-500">This link may have expired or is not available for your practice.</p>
      <Link href="/app" className="btn-primary">Go to dashboard</Link>
    </main>
  );
}
