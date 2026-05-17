"use client";

import { useState, useEffect } from "react";
import type { Signal } from "../../lib/api";

type Strategy = "all" | "rockstar" | "sniper" | "watcher";

const TABS: { value: Strategy; label: string }[] = [
  { value: "all", label: "All" },
  { value: "sniper", label: "🎯 Sniper" },
  { value: "rockstar", label: "🔥 Rockstar" },
  { value: "watcher", label: "🏔️ Watcher" },
];

function deriveStrategyVerdict(signal: Signal, strategy: Strategy) {
  const ind = signal.indicators ?? {};
  const adx = ind.adx ?? 0;
  const rsi = ind.rsi ?? 50;
  const vol = ind.volume_ratio ?? 0;
  const ema50 = ind.ema50 ?? 0;
  const ema200 = ind.ema200 ?? 0;

  if (strategy === "rockstar") {
    const emaOk = ema50 > 0 && ema200 > 0;
    const trendStrong = adx >= 25;
    if (signal.trend === "bullish" && trendStrong) return { verdict: "GO — Trend confirmed", color: "text-buy", note: `EMA50 above EMA200 · ADX ${Math.round(adx)} strong trend · Follow the trend, wait for pullback entry. Rockstar says long bias.` };
    if (signal.trend === "bullish" && !trendStrong) return { verdict: "WAIT — Trend forming", color: "text-wait", note: `EMA50 above EMA200 but ADX ${Math.round(adx)} < 25. Trend not yet confirmed strong. Rockstar waits for ADX ≥ 25.` };
    if (signal.trend === "bearish" && trendStrong) return { verdict: "GO SHORT — Downtrend confirmed", color: "text-sell", note: `EMA50 below EMA200 · ADX ${Math.round(adx)} strong downtrend · Rockstar says short bias.` };
    if (signal.trend === "bearish" && !trendStrong) return { verdict: "WAIT — Downtrend forming", color: "text-wait", note: `EMA50 below EMA200 but ADX ${Math.round(adx)} weak. Rockstar waits for trend to strengthen.` };
    return { verdict: "STAY OUT — No trend", color: "text-zinc-500", note: `ADX ${Math.round(adx)} — sideways/choppy market. Rockstar only trades confirmed trends. Flat.` };
  }

  if (strategy === "sniper") {
    const breakout = signal.action === "long_setup" || signal.action === "short_setup";
    const volOk = vol >= 1.3;
    if (breakout && volOk) return { verdict: "FIRE — Trigger active", color: "text-buy", note: `20-period breakout confirmed · Volume ${vol.toFixed(1)}× above avg · MACD aligned. Sniper has a clean entry. Pull the trigger.` };
    if (breakout && !volOk) return { verdict: "PARTIAL — Weak volume", color: "text-wait", note: `Breakout signal present but volume ${vol.toFixed(1)}× below 1.3× threshold. Sniper waits for volume confirmation.` };
    if (signal.action === "watch") return { verdict: "WATCH — Setup forming", color: "text-wait", note: `Trend active but no clean breakout yet. Sniper sets alert at 20-period high/low. Wait for volume spike.` };
    return { verdict: "STAND DOWN — No trigger", color: "text-zinc-500", note: `No breakout, no volume expansion. Sniper only fires on confirmed breakouts with volume. Stay flat.` };
  }

  if (strategy === "watcher") {
    const rsiOversold = rsi < 35;
    const rsiOverbought = rsi > 70;
    if (signal.trend === "bullish" && rsiOversold) return { verdict: "ACCUMULATE — Value zone", color: "text-buy", note: `Bullish trend + RSI ${Math.round(rsi)} oversold zone. Watcher sees a value entry opportunity. DCA in tranches.` };
    if (signal.trend === "bullish" && !rsiOversold && !rsiOverbought) return { verdict: "HOLD — Trend intact", color: "text-buy", note: `Bullish trend confirmed, RSI ${Math.round(rsi)} healthy range. Watcher holds existing position. Trail stop.` };
    if (signal.trend === "bullish" && rsiOverbought) return { verdict: "WAIT — Overheated", color: "text-wait", note: `Bullish trend but RSI ${Math.round(rsi)} overbought. Watcher does not chase. Wait for RSI to cool below 60.` };
    if (signal.trend === "bearish") return { verdict: "AVOID — Downtrend", color: "text-sell", note: `Long-term downtrend. Watcher avoids accumulation in downtrends. Cash is a position.` };
    return { verdict: "MONITOR — Sideways", color: "text-zinc-500", note: `No clear trend. Watcher monitors and waits for Stage 2 breakout. Not a buy yet.` };
  }

  return null;
}

type ActionItem = { icon: string; label: string; text: string };

function deriveActions(signal: Signal, strategy: Strategy): ActionItem[] {
  const tp = signal.tp ? signal.tp.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—";
  const sl = signal.sl ? signal.sl.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—";
  const ind = signal.indicators ?? {};
  const adx = Math.round(ind.adx ?? 0);
  const rsi = Math.round(ind.rsi ?? 50);

  if (strategy === "sniper") {
    return [
      { icon: "🆓", label: "Flat", text: signal.action === "long_setup" ? `Set alert at ${signal.close}. Enter on breakout + volume ≥ 1.3×. Stop ${sl}, target ${tp}.` : signal.action === "short_setup" ? `Set alert at ${signal.close}. Enter on breakdown + volume ≥ 1.3×. Stop ${sl}, target ${tp}.` : "Wait for clean breakout setup. Sniper does not force entry." },
      { icon: "🟢", label: "Long low cb", text: `Hold. Tighten stop to ${sl}. Take 30% off at TP1 (${tp}). Trail remainder.` },
      { icon: "🟡", label: "Long mid cb", text: `Hold but set hard stop ${sl} immediately. If price stalls 2 days — consider partial exit.` },
      { icon: "🔴", label: "Long high cb / underwater", text: "Cut or set tight stop. Sniper does not hold losing breakout trades — they either work quickly or they don't." },
    ];
  }
  if (strategy === "rockstar") {
    return [
      { icon: "🆓", label: "Flat", text: signal.trend === "bullish" ? `Trend confirmed (ADX ${adx}). Wait for pullback to EMA50 for lower-risk entry. Don't chase breakouts.` : signal.trend === "bearish" ? `Downtrend active (ADX ${adx}). Short on rallies, not breakdowns. Wait for retest.` : "No trend (ADX low). Rockstar stays flat in choppy markets." },
      { icon: "🟢", label: "Long low cb (trend following)", text: `Trend is your friend. Hold and trail stop below EMA50. Add size only if ADX ${adx} continues rising.` },
      { icon: "🟡", label: "Long mid cb", text: `Hold if trend intact. If EMA50 loses EMA200 — exit immediately. Trend is the signal.` },
      { icon: "🔴", label: "Long high cb / against trend", text: signal.trend === "bearish" ? "Bearish trend active — if you're long, review thesis. Stop below last swing low." : "Above entry in bullish trend. Hold with trailing stop." },
    ];
  }
  if (strategy === "watcher") {
    return [
      { icon: "🆓", label: "Flat", text: rsi < 40 && signal.trend === "bullish" ? `RSI ${rsi} — value zone. Accumulate 25% position. DCA on further weakness. Target long-term hold.` : signal.trend === "bullish" ? `Bullish trend intact but RSI ${rsi} not oversold yet. Wait for RSI < 40 for better entry.` : "Watcher avoids entry without bullish structure. Cash is a position — patience." },
      { icon: "🟢", label: "Long low cb", text: `Hold long-term. Trail stop below major swing low. Not ${sl} — structure stop. Thesis > price action.` },
      { icon: "🟡", label: "Long mid cb", text: "Monitor. Stress-test your thesis. If fundamentals unchanged — hold. If thesis broke — exit, not average down." },
      { icon: "🔴", label: "Long high cb / underwater", text: "Analyze honestly: is this a value trap? Watcher does not DCA into broken trends. Define your invalidation and honor it." },
    ];
  }
  // "all" — generic
  return [
    { icon: "🆓", label: "Flat", text: signal.action === "long_setup" ? `Entry zone ${signal.close}. Stop ${sl}. Target ${tp}.` : signal.action === "short_setup" ? `Short zone ${signal.close}. Stop ${sl}. Target ${tp}.` : "Wait for cleaner setup before entering." },
    { icon: "🟢", label: "Long low cb", text: `Hold. Trail stop to ${sl}.` },
    { icon: "🔴", label: "Long high cb", text: "Review stop placement." },
  ];
}

export default function StrategyView({ signal }: { signal: Signal }) {
  const [active, setActive] = useState<Strategy>("all");

  useEffect(() => {
    const saved = localStorage.getItem("investor_dna") as Strategy ?? "all";
    setActive(saved);
  }, []);

  function select(s: Strategy) {
    setActive(s);
    localStorage.setItem("investor_dna", s);
  }

  return (
    <div className="border border-line bg-white">
      {/* Tab bar */}
      <div className="flex border-b border-line bg-panel">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => select(t.value)}
            className={`px-4 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
              active === t.value
                ? "border-ink text-ink bg-white"
                : "border-transparent text-zinc-400 hover:text-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-5 py-4 space-y-3">
        {active === "all" ? (
          // Show all three strategies
          (["sniper", "rockstar", "watcher"] as Strategy[]).map((s) => {
            const v = deriveStrategyVerdict(signal, s);
            if (!v) return null;
            const tab = TABS.find((t) => t.value === s)!;
            return (
              <div key={s} className="border border-line bg-panel px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-zinc-500">{tab.label}</span>
                  <span className={`text-xs font-bold ${v.color}`}>{v.verdict}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{v.note}</p>
              </div>
            );
          })
        ) : (
          (() => {
            const v = deriveStrategyVerdict(signal, active);
            const tab = TABS.find((t) => t.value === active)!;
            if (!v) return null;
            return (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-zinc-500">{tab.label}</span>
                  <span className={`text-sm font-bold ${v.color}`}>{v.verdict}</span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-600">{v.note}</p>
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
