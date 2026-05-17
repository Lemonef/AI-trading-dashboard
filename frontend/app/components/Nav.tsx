"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart2, List } from "lucide-react";

const tabs = [
  { href: "/", label: "Signals", icon: BarChart2 },
  { href: "/watchlist", label: "Watchlist", icon: List },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-line bg-[#F7F6F0]">
      <div className="mx-auto flex max-w-7xl items-center px-5">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                active
                  ? "border-ink text-ink"
                  : "border-transparent text-zinc-400 hover:text-zinc-700"
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
