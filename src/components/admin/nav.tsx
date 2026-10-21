"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Overview", icon: "📊", exact: true },
  { href: "/users", label: "Users", icon: "🧑‍🍳" },
  { href: "/recipes", label: "AI recipes", icon: "🍲" },
  { href: "/ratings", label: "Ratings", icon: "⭐" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname === l.href || pathname.startsWith(`${l.href}/`);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2 text-sm font-bold transition ${
              active ? "bg-cocoa text-cream shadow-pop" : "text-zinc-600 hover:bg-white hover:text-cocoa"
            }`}
          >
            <span aria-hidden>{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
