"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    label: "Kitchen",
    links: [
      { href: "/", label: "Overview", icon: "📊", exact: true },
      { href: "/users", label: "Users", icon: "🧑‍🍳" },
      { href: "/recipes", label: "AI recipes", icon: "🍲" },
      { href: "/media", label: "AI media", icon: "🖼️" },
      { href: "/ratings", label: "Ratings", icon: "⭐" },
    ],
  },
  {
    label: "Prompting",
    links: [
      { href: "/prompt-chains", label: "Prompt chains", icon: "⛓️" },
      { href: "/mix", label: "Chain mix", icon: "⚖️" },
      { href: "/terms", label: "Terms", icon: "📖" },
      { href: "/examples", label: "Examples", icon: "🧪" },
    ],
  },
  {
    label: "Models",
    links: [
      { href: "/models", label: "LLM models", icon: "🧠" },
      { href: "/providers", label: "LLM providers", icon: "🔌" },
    ],
  },
  {
    label: "Observability",
    links: [
      { href: "/requests", label: "Gen requests", icon: "📥" },
      { href: "/responses", label: "LLM responses", icon: "💬" },
    ],
  },
  {
    label: "Access",
    links: [
      { href: "/signup-domains", label: "Signup domains", icon: "🏫" },
      { href: "/whitelist", label: "Whitelisted emails", icon: "✉️" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-3 lg:overflow-y-auto lg:pb-0">
      {GROUPS.map((g) => (
        <div key={g.label} className="flex gap-1 lg:flex-col">
          <p className="hidden px-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 lg:block">{g.label}</p>
          {g.links.map((l) => {
            const active = "exact" in l && l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-1.5 text-sm font-bold transition ${
                  active ? "bg-cocoa text-cream shadow-pop" : "text-zinc-600 hover:bg-white hover:text-cocoa"
                }`}
              >
                <span aria-hidden>{l.icon}</span>
                {l.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
