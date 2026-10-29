import Link from "next/link";

/** The Arcus mark: an arch. */
export function ArcusMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" className="fill-brand-600" />
      <path d="M9 24V15a7 7 0 0 1 14 0v9" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", product }: { href?: string; product?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-semibold text-slate-900">
      <ArcusMark />
      <span className="text-lg tracking-tight">
        Arcus{product && <span className="font-normal text-slate-500"> {product}</span>}
      </span>
    </Link>
  );
}
