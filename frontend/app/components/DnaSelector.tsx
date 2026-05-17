"use client";

import { useState, useEffect } from "react";

const DNA_OPTIONS = [
  { value: "all", label: "All Strategies" },
  { value: "rockstar", label: "🔥 Rockstar (Trend)" },
  { value: "sniper", label: "🎯 Sniper (Entry)" },
  { value: "watcher", label: "🏔️ Watcher (Long-term)" },
];

export default function DnaSelector() {
  const [selected, setSelected] = useState("all");

  useEffect(() => {
    const saved = localStorage.getItem("investor_dna") ?? "all";
    setSelected(saved);
  }, []);

  function onChange(val: string) {
    setSelected(val);
    localStorage.setItem("investor_dna", val);
    window.dispatchEvent(new StorageEvent("storage", { key: "investor_dna", newValue: val }));
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 hidden sm:block">Strategy</span>
      <select
        value={selected}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 rounded border border-line bg-white px-2 text-xs text-ink outline-none focus:border-zinc-400 cursor-pointer"
      >
        {DNA_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}
