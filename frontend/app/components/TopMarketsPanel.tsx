"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
type DNA = "rockstar" | "sniper" | "watcher";

interface MarketScore {
  symbol: string;
  asset_class: string;
  score: number;
  trend: string;
  adx: number;
  rsi: number;
  volume_ratio: number;
  trend_strength: number;
}

function symbolToSlug(s: string): string {
  return s.replace(/\//g, "--").replace(/=/g, "__");
}

function fmt(v: number | null | undefined, d = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: d });
}

function filterByDna(markets: MarketScore[], dna: DNA): MarketScore[] {
  let filtered: MarketScore[];
  if (dna === "rockstar") {
    filtered = markets.filter((m) => m.trend !== "sideways" && m.adx >= 25);
    filtered.sort((a, b) => b.adx - a.adx);
  } else if (dna === "sniper") {
    filtered = markets.filter((m) => m.volume_ratio >= 1.3);
    filtered.sort((a, b) => b.volume_ratio - a.volume_ratio);
  } else {
    filtered = markets.filter((m) => m.trend === "bullish" && m.rsi < 40);
    filtered.sort((a, b) => b.score - a.score);
  }
  return filtered.slice(0, 3);
}

function dnaLabel(dna: DNA) {
  if (dna === "rockstar") return "🔥 Rockstar";
  if (dna === "sniper") return "🎯 Sniper";
  return "🏔️ Watcher";
}

function dnaSubtitle(dna: DNA) {
  if (dna === "rockstar") return "Strong trend · ADX ≥ 25";
  if (dna === "sniper") return "High volume · Vol ≥ 1.3×";
  return "Bullish + RSI oversold < 40";
}

function chipColor(value: number, low: number, high: number) {
  if (value >= high) return "bg-green-100 text-green-700";
  if (value >= low) return "bg-zinc-100 text-zinc-600";
  return "bg-zinc-50 text-zinc-400";
}

export default function TopMarketsPanel() {
  const [markets, setMarkets] = useState<MarketScore[]>([]);
  const [dna, setDna] = useState<DNA>("rockstar");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("investor_dna") as DNA | null;
    if (saved && ["rockstar", "sniper", "watcher"].includes(saved)) setDna(saved);

    const onStorage = () => {
      const v = localStorage.getItem("investor_dna") as DNA | null;
      if (v && ["rockstar", "sniper", "watcher"].includes(v)) setDna(v);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then(setMarkets)
      .catch(() => {});
  }, []);

  function selectDna(d: DNA) {
    setDna(d);
    setExpanded(null);
    localStorage.setItem("investor_dna", d);
    window.dispatchEvent(new Event("storage"));
  }

  const top = filterByDna(markets, dna);

  return (
    <section className="card-lift border border-line bg-white">
      <div className="flex gap-1.5 flex-wrap border-b border-line px-4 py-3">
        {(["rockstar", "sniper", "watcher"] as DNA[]).map((d) => (
          <button
            key={d}
            onClick={() => selectDna(d)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
              dna === d
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-zinc-500 hover:border-zinc-400 hover:text-ink"
            }`}
          >
            {dnaLabel(d)}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3 pb-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          Top for {dnaLabel(dna)}
        </div>
        <div className="text-[10px] text-zinc-400 mt-0.5">{dnaSubtitle(dna)}</div>
      </div>

      {top.length === 0 ? (
        <div className="px-4 py-4 text-xs text-zinc-400">
          No markets match — run discovery scan first.
        </div>
      ) : (
        <ul>
          {top.map((m) => {
            const isExpanded = expanded === m.symbol;
            return (
              <li key={m.symbol} className="border-t border-line">
                <div
                  className="flex cursor-pointer items-start justify-between px-4 py-3 hover:bg-[#FAFAF7] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : m.symbol)}
                >
                  <div>
                    <div className="font-semibold text-sm text-ink leading-tight">
                      {m.symbol}
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${chipColor(m.adx, 20, 30)}`}>
                        ADX {fmt(m.adx)}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${chipColor(100 - m.rsi, 30, 65)}`}>
                        RSI {fmt(m.rsi)}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${chipColor(m.volume_ratio, 1.1, 1.3)}`}>
                        Vol {fmt(m.volume_ratio)}×
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                    <span
                      className={`border px-1.5 py-0.5 text-[10px] font-semibold ${
                        m.trend === "bullish"
                          ? "border-buy text-buy"
                          : m.trend === "bearish"
                          ? "border-sell text-sell"
                          : "border-zinc-300 text-zinc-400"
                      }`}
                    >
                      {m.trend}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {Math.round(m.score * 100)}%
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-line bg-[#F7F6F0] px-4 py-3">
                    <dl className="grid grid-cols-3 gap-2">
                      {[
                        { label: "ADX", value: fmt(m.adx) },
                        { label: "RSI", value: fmt(m.rsi) },
                        { label: "Vol ×", value: fmt(m.volume_ratio) },
                        { label: "Score", value: `${Math.round(m.score * 100)}%` },
                        { label: "Trend", value: m.trend },
                        { label: "Class", value: m.asset_class },
                      ].map(({ label, value }) => (
                        <div key={label} className="border border-line bg-white px-2 py-1.5">
                          <dt className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                            {label}
                          </dt>
                          <dd className="mt-0.5 text-xs font-semibold text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <Link
                      href={`/signals/${symbolToSlug(m.symbol)}`}
                      className="mt-2.5 flex items-center text-[11px] font-semibold text-zinc-500 hover:text-ink"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open full analysis →
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
