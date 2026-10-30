import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-cocoa sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-zinc-600">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, note, children, className = "" }: { title?: string; note?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[28px] border-2 border-zinc-200 bg-white p-5 shadow-soft ${className}`}>
      {title && (
        <header className="mb-4">
          <h2 className="text-lg font-semibold text-cocoa">{title}</h2>
          {note && <p className="mt-0.5 text-sm text-zinc-500">{note}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Stars({ value, size = "text-sm" }: { value: number; size?: string }) {
  const full = Math.round(value);
  return (
    <span className={`${size} tracking-tight`} aria-label={`${value.toFixed(1)} stars`}>
      <span className="text-butter-deep">{"★".repeat(full)}</span>
      <span className="text-zinc-200">{"★".repeat(5 - full)}</span>
    </span>
  );
}

export function Pill({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "red" | "pink" | "mint" | "sky" | "butter" | "lilac" | "cocoa" }) {
  const tones = {
    zinc: "bg-zinc-100 text-zinc-700",
    red: "bg-red-100 text-red-800",
    pink: "bg-emerald-100 text-emerald-800",
    mint: "bg-mint text-emerald-950",
    sky: "bg-sky text-sky-900",
    butter: "bg-butter text-amber-900",
    lilac: "bg-lilac text-violet-900",
    cocoa: "bg-cocoa text-cream",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${tones[tone]}`}>{children}</span>;
}

export function Avatar({ url, name, size = "h-8 w-8" }: { url: string | null; name: string; size?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold uppercase text-emerald-800`}>
      {name.charAt(0)}
    </span>
  );
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-between text-sm font-bold">
      {page > 1 ? (
        <Link href={href(page - 1)} className="rounded-full border-2 border-zinc-200 bg-white px-4 py-1.5 hover:border-emerald-300">
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-zinc-500">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={href(page + 1)} className="rounded-full border-2 border-zinc-200 bg-white px-4 py-1.5 hover:border-emerald-300">
          Next
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}

export const inputClass =
  "w-full rounded-2xl border-2 border-zinc-200 bg-white px-3 py-2 text-sm text-cocoa outline-none transition placeholder:text-zinc-400 focus:border-emerald-400";
export const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-pop transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:opacity-60";
export const ghostButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-full border-2 border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-700 transition hover:border-emerald-300 hover:text-cocoa";
