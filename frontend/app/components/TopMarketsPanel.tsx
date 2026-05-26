"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Signal } from "../../lib/types";

type DNA = "rockstar" | "sniper" | "watcher";

function symbolToSlug(s: string): string {
  return s.replace(/\//g, "--").replace(/=/g, "__");
}

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: d });
}

const INDICATOR_LABELS: Record<string, string> = {
  ema50: "EMA 50", ema200: "EMA 200", macd: "MACD",
  macd_signal: "MACD Sig", adx: "ADX", rsi: "RSI",
  atr: "ATR", volume_ratio: "Vol ×",
};

function indicatorColor(key: string, value: number | null): string {
  if (value == null) return "text-zinc-400";
  if (key === "rsi") return value > 70 ? "text-sell font-bold" : value < 30 ? "text-buy font-bold" : "text-ink";
  if (key === "adx") return value >= 30 ? "text-buy" : value >= 20 ? "text-wait" : "text-zinc-500";
  if (key === "volume_ratio" && value >= 1.3) return "text-buy";
  return "text-ink";
}

function filterByDna(signals: Signal[], dna: DNA): Signal[] {
  let filtered: Signal[];
  if (dna === "rockstar") {
    // Strong trend + ADX ≥ 20
    filtered = signals.filter(
      (s) => s.trend !== "sideways" && (s.indicators?.adx ?? 0) >= 20
    );
    filtered.sort((a, b) => (b.indicators?.adx ?? 0) - (a.indicators?.adx ?? 0));
  } else if (dna === "sniper") {
    // Active setups (long or short) sorted by confidence
    filtered = signals.filter(
      (s) => s.action === "long_setup" || s.action === "short_setup"
    );
    filtered.sort((a, b) => b.confidence - a.confidence);
  } else {
    // Watcher: watch signals + bullish trend, sorted by confidence
    filtered = signals.filter(
      (s) => s.action === "watch" && s.trend === "bullish"
    );
    filtered.sort((a, b) => b.confidence - a.confidence);
  }
  return filtered.slice(0, 5);
}

function dnaLabel(dna: DNA) {
  if (dna === "rockstar") return "🔥 Rockstar";
  if (dna === "sniper") return "🎯 Sniper";
  return "🏔️ Watcher";
}

function dnaSubtitle(dna: DNA) {
  if (dna === "rockstar") return "Strong trend · ADX ≥ 20";
  if (dna === "sniper") return "Active setups by confidence";
  return "Watching bullish setups";
}

function actionBadgeClass(action: Signal["action"]) {
  if (action === "long_setup") return "border-buy text-buy";
  if (action === "short_setup") return "border-sell text-sell";
  if (action === "watch") return "border-wait text-wait";
  return "border-zinc-300 text-zinc-400";
}

interface Props {
  signals: Signal[];
}

export default function TopMarketsPanel({ signals }: Props) {
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

  function selectDna(d: DNA) {
    setDna(d);
    setExpanded(null);
    localStorage.setItem("investor_dna", d);
    window.dispatchEvent(new Event("storage"));
  }

  const top = filterByDna(signals, dna);

  return (
    <section className="card-lift border border-line bg-white">
      {/* DNA chips */}
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

      {/* Header */}
      <div className="px-4 pt-3 pb-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          Top for {dnaLabel(dna)}
        </div>
        <div className="text-[10px] text-zinc-400 mt-0.5">{dnaSubtitle(dna)}</div>
      </div>

      {top.length === 0 ? (
        <div className="px-4 py-4 text-xs text-zinc-400">
          No signals match this filter.
        </div>
      ) : (
        <ul>
          {top.map((s) => {
            const isExpanded = expanded === s.symbol;
            const indicators = s.indicators ?? {};
            return (
              <li key={s.symbol} className="border-t border-line">
                {/* Row */}
                <div
                  className="flex cursor-pointer items-start justify-between px-4 py-3 hover:bg-[#FAFAF7] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : s.symbol)}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-ink leading-tight truncate">
                      {s.symbol}
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {Math.round(s.confidence * 100)}% confidence
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                    <span className={`border px-1.5 py-0.5 text-[10px] font-semibold ${actionBadgeClass(s.action)}`}>
                      {s.action.replace("_", " ")}
                    </span>
                    <span className={`text-[10px] font-medium ${
                      s.trend === "bullish" ? "text-buy" : s.trend === "bearish" ? "text-sell" : "text-zinc-400"
                    }`}>
                      {s.trend} {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {/* Expanded indicator panel */}
                {isExpanded && (
                  <div className="border-t border-line bg-[#F7F6F0] px-4 py-3">
                    <dl className="grid grid-cols-2 gap-2">
                      {Object.entries(indicators).map(([key, value]) => (
                        <div key={key} className="border border-line bg-white px-3 py-2">
                          <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                            {INDICATOR_LABELS[key] ?? key}
                          </dt>
                          <dd className={`mt-0.5 text-sm tabular-nums ${indicatorColor(key, value)}`}>
                            {fmt(value, key === "volume_ratio" ? 2 : key === "rsi" || key === "adx" ? 1 : 2)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {s.tp != null && (
                      <div className="mt-2 flex gap-3 text-[11px]">
                        <span className="text-buy font-semibold">TP {fmt(s.tp)}</span>
                        <span className="text-sell font-semibold">SL {fmt(s.sl)}</span>
                      </div>
                    )}
                    <Link
                      href={`/signals/${symbolToSlug(s.symbol)}`}
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
