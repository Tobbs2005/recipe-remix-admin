import type { ReactNode } from "react";
import { DOWS } from "@/lib/admin/stats";

/* Small, dependency-free charts. Every mark has a native hover tooltip (title)
   and the numbers are also printed as text, so nothing relies on color alone. */

export function StatTile({ label, value, hint, emoji }: { label: string; value: ReactNode; hint?: ReactNode; emoji: string }) {
  return (
    <div className="rounded-[24px] border-2 border-zinc-200 bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p>
        <span aria-hidden className="text-lg">{emoji}</span>
      </div>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums text-cocoa">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/** Horizontal bars: magnitude in one hue, an optional right-side annotation. */
export function HBars({
  rows,
  color = "bg-emerald-400",
  unit = "",
}: {
  rows: { label: ReactNode; value: number; note?: ReactNode; tip?: string }[];
  color?: string;
  unit?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <Empty />;
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={i} className="grid grid-cols-[minmax(0,7.5rem)_1fr_auto] items-center gap-3 text-sm" title={r.tip}>
          <span className="truncate font-semibold text-zinc-700">{r.label}</span>
          <span className="h-3.5 rounded-full bg-zinc-100">
            <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
          </span>
          <span className="min-w-14 text-right tabular-nums text-zinc-600">
            {r.value}
            {unit}
            {r.note && <span className="ml-2 text-zinc-500">{r.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Star histogram (1-5), single hue. */
export function StarHistogram({ dist }: { dist: { stars: number; n: number }[] }) {
  const max = Math.max(1, ...dist.map((d) => d.n));
  const total = dist.reduce((a, d) => a + d.n, 0);
  return (
    <div className="flex h-44 items-end gap-3">
      {dist.map((d) => (
        <div
          key={d.stars}
          className="flex h-full flex-1 flex-col items-center justify-end gap-1"
          title={`${d.stars} star${d.stars > 1 ? "s" : ""}: ${d.n} ratings (${total ? Math.round((d.n / total) * 100) : 0}%)`}
        >
          <span className="text-xs font-bold tabular-nums text-zinc-600">{d.n}</span>
          <span className="w-full rounded-t-lg bg-butter-deep transition hover:brightness-95" style={{ height: `${Math.max(2, (d.n / max) * 100)}%` }} />
          <span className="text-xs font-bold text-zinc-500">{d.stars}★</span>
        </div>
      ))}
    </div>
  );
}

/** 30-day activity: recipes and ratings as two small-multiple bar rows (one axis each, no dual axis). */
export function DailyActivity({ days }: { days: { key: string; recipes: number; ratings: number }[] }) {
  const series = [
    { key: "recipes" as const, label: "Recipes created", color: "bg-emerald-400" },
    { key: "ratings" as const, label: "Ratings given", color: "bg-sky-deep" },
  ];
  const fmt = (k: string) => new Date(`${k}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return (
    <div className="space-y-5">
      {series.map((s) => {
        const max = Math.max(1, ...days.map((d) => d[s.key]));
        const total = days.reduce((a, d) => a + d[s.key], 0);
        return (
          <div key={s.key}>
            <div className="mb-1.5 flex items-center justify-between text-xs font-bold text-zinc-600">
              <span className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-sm ${s.color}`} />
                {s.label}
              </span>
              <span className="tabular-nums">{total} in 30 days · peak {max}/day</span>
            </div>
            <div className="flex h-16 items-end gap-[2px]">
              {days.map((d) => (
                <span key={d.key} className="group flex h-full flex-1 items-end" title={`${fmt(d.key)}: ${d[s.key]} ${s.label.toLowerCase()}`}>
                  <span
                    className={`w-full rounded-t-[3px] ${d[s.key] ? s.color : "bg-zinc-100"} group-hover:brightness-90`}
                    style={{ height: d[s.key] ? `${Math.max(6, (d[s.key] / max) * 100)}%` : "3px" }}
                  />
                </span>
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex justify-between text-[11px] font-semibold text-zinc-400">
        <span>{fmt(days[0].key)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

const HEAT = ["bg-zinc-100", "bg-emerald-100", "bg-emerald-200", "bg-emerald-300", "bg-emerald-500", "bg-emerald-700"];
const hourLabel = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

/** Day-of-week x hour heatmap, one hue light to dark. */
export function KitchenClock({ clock }: { clock: number[][] }) {
  const max = Math.max(1, ...clock.flat());
  const step = (n: number) => (n === 0 ? 0 : Math.min(HEAT.length - 1, 1 + Math.floor((n / max) * (HEAT.length - 1.001))));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[560px]">
        <div className="grid grid-cols-[2.5rem_repeat(24,1fr)] gap-[3px]">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center text-[10px] font-semibold text-zinc-400">
              {h % 3 === 0 ? hourLabel(h) : ""}
            </span>
          ))}
          {clock.map((row, d) => (
            <div key={d} className="contents">
              <span className="pr-1 text-right text-[11px] font-bold leading-5 text-zinc-500">{DOWS[d]}</span>
              {row.map((n, h) => (
                <span
                  key={h}
                  title={`${DOWS[d]} ${hourLabel(h)} ET: ${n} action${n === 1 ? "" : "s"}`}
                  className={`h-5 rounded-[4px] ${HEAT[step(n)]} ring-cocoa/40 hover:ring-2`}
                />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-zinc-500">
          Fewer
          {HEAT.map((c) => (
            <span key={c} className={`h-3 w-3 rounded-[3px] ${c}`} />
          ))}
          More
        </div>
      </div>
    </div>
  );
}

export function Empty({ children = "No data yet." }: { children?: ReactNode }) {
  return <p className="rounded-2xl bg-zinc-50 p-4 text-center text-sm text-zinc-500">{children}</p>;
}
