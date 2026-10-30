export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-3xl border-2 border-zinc-200 bg-white p-4 shadow-soft">
      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-cocoa">{value}</p>
      {note && <p className="mt-0.5 text-xs text-zinc-500">{note}</p>}
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const tone =
    status === "succeeded" || status === "ok"
      ? "bg-mint text-emerald-950"
      : status === "failed" || status === "error"
        ? "bg-red-100 text-red-800"
        : "bg-butter text-amber-900";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ${tone}`}>{status}</span>;
}
