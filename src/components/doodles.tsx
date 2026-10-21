// Hand-drawn style kawaii food stickers (original SVGs). Each takes a className for sizing.
type P = { className?: string; style?: React.CSSProperties };
const S = "#3d2b28";
const line = { stroke: S, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Face({ cx, cy, gap = 9, blush = "#ff9fb8" }: { cx: number; cy: number; gap?: number; blush?: string }) {
  return (
    <g>
      <circle cx={cx - gap} cy={cy} r={2.4} fill={S} />
      <circle cx={cx + gap} cy={cy} r={2.4} fill={S} />
      <path d={`M${cx - 4} ${cy + 4} q4 4 8 0`} fill="none" {...line} strokeWidth={2.4} />
      <ellipse cx={cx - gap - 5} cy={cy + 5} rx={4} ry={2.4} fill={blush} opacity={0.8} />
      <ellipse cx={cx + gap + 5} cy={cy + 5} rx={4} ry={2.4} fill={blush} opacity={0.8} />
    </g>
  );
}

export function Pot({ className, style, steaming = true }: P & { steaming?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      {steaming && (
        <g fill="none" {...line} stroke="#c7a594" strokeWidth={2.6}>
          <path className="animate-steam" d="M38 26 q-5 -6 0 -12 q5 -6 0 -12" />
          <path className="animate-steam [animation-delay:0.8s]" d="M50 24 q-5 -6 0 -12 q5 -6 0 -12" />
          <path className="animate-steam [animation-delay:1.6s]" d="M62 26 q-5 -6 0 -12 q5 -6 0 -12" />
        </g>
      )}
      <rect x="26" y="30" width="48" height="6" rx="3" fill="#ffd8b0" {...line} />
      <circle cx="50" cy="28" r="3.5" fill="#ffd8b0" {...line} />
      <path d="M22 38 h56 v28 q0 16 -16 16 h-24 q-16 0 -16 -16 z" fill="#ffc9d7" {...line} />
      <path d="M22 46 h-7 q-4 0 -4 4 v2 q0 4 4 4 h7 M78 46 h7 q4 0 4 4 v2 q0 4 -4 4 h-7" fill="none" {...line} />
      <Face cx={50} cy={58} />
    </svg>
  );
}

export function Egg({ className, style }: P) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <path d="M50 12 c18 0 22 10 32 16 c10 7 8 22 2 30 c-6 9 -2 24 -18 28 c-14 4 -18 -4 -30 -2 c-14 2 -26 -6 -26 -20 c0 -12 8 -14 8 -26 c0 -16 14 -26 32 -26 z" fill="#ffffff" {...line} />
      <circle cx="50" cy="52" r="18" fill="#ffd96b" {...line} />
      <circle cx="44" cy="45" r="4" fill="#fff6c9" />
      <Face cx={50} cy={53} gap={6} />
    </svg>
  );
}

export function Tomato({ className, style }: P) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <circle cx="50" cy="56" r="32" fill="#ff8f8f" {...line} />
      <path d="M50 26 l-8 -8 m8 8 l-14 2 m14 -2 l14 2 m-14 -2 l8 -8 m-8 8 v-12" fill="none" {...line} stroke="#3e9a6a" strokeWidth={4} />
      <ellipse cx="36" cy="44" rx="6" ry="4" fill="#ffffff" opacity={0.55} />
      <Face cx={50} cy={60} />
    </svg>
  );
}

export function Avocado({ className, style }: P) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <path d="M50 8 c14 0 18 18 24 32 c8 18 6 50 -24 50 c-30 0 -32 -32 -24 -50 c6 -14 10 -32 24 -32 z" fill="#a6d98a" {...line} />
      <path d="M50 20 c9 0 12 14 16 24 c6 14 4 36 -16 36 c-20 0 -22 -22 -16 -36 c4 -10 7 -24 16 -24 z" fill="#e6f6c4" />
      <circle cx="50" cy="62" r="12" fill="#b07a55" {...line} />
      <Face cx={50} cy={40} gap={7} />
    </svg>
  );
}

export function Carrot({ className, style }: P) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <path d="M44 22 q-8 -12 -2 -16 q6 4 6 14 M52 20 q2 -14 10 -14 q2 8 -6 16 M48 22 q-12 -6 -18 0 q8 6 16 4" fill="#7cc98f" {...line} />
      <path d="M34 28 q16 -8 30 0 q2 20 -12 62 q-4 6 -8 0 q-14 -42 -10 -62 z" fill="#ffab6a" {...line} />
      <path d="M40 50 h6 M50 64 h6 M44 76 h5" fill="none" {...line} strokeWidth={2.4} />
      <Face cx={49} cy={40} gap={6} />
    </svg>
  );
}

export function Whisk({ className, style }: P) {
  return (
    <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
      <rect x="44" y="58" width="12" height="34" rx="6" fill="#e8defc" {...line} />
      <path d="M50 58 c-22 -10 -20 -50 0 -50 c20 0 22 40 0 50 M50 58 c-10 -10 -10 -46 0 -46 c10 0 10 36 0 46 M50 58 v-46" fill="none" {...line} />
    </svg>
  );
}

export function Sparkle({ className, style, color = "#ffd96b" }: P & { color?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden>
      <path d="M20 3 q3 14 17 17 q-14 3 -17 17 q-3 -14 -17 -17 q14 -3 17 -17 z" fill={color} {...line} strokeWidth={2.2} />
    </svg>
  );
}

export function Heart({ className, style, color = "#ffacc1" }: P & { color?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} style={style} aria-hidden>
      <path d="M20 34 c-10 -7 -16 -12 -16 -20 c0 -5 4 -9 9 -9 c3 0 6 2 7 5 c1 -3 4 -5 7 -5 c5 0 9 4 9 9 c0 8 -6 13 -16 20 z" fill={color} {...line} strokeWidth={2.4} />
    </svg>
  );
}

/** Scattered floating stickers for hero areas. Purely decorative. */
export function FloatingDoodles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <Sparkle className="absolute left-[6%] top-[14%] h-6 w-6 animate-twinkle" />
      <Heart className="absolute right-[38%] top-[10%] h-5 w-5 animate-float [--r:-10deg]" />
      <Sparkle className="absolute bottom-[8%] left-[46%] h-5 w-5 animate-twinkle [animation-delay:1s]" color="#cdeedd" />
      <Heart className="absolute bottom-[6%] right-[4%] h-6 w-6 animate-float-slow [--r:12deg]" color="#e8defc" />
    </div>
  );
}
