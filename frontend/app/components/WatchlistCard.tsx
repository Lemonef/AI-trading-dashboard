"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, MoreHorizontal } from "lucide-react";
import { symbolToSlug, type Signal } from "../../lib/api";
import WatchlistToggle from "./WatchlistToggle";
import AlertPanel from "./AlertPanel";

const actionLabels: Record<Signal["action"], string> = {
  long_setup: "Long setup", short_setup: "Short setup", watch: "Watch", no_trade: "No trade",
};

function toneFor(action: Signal["action"]) {
  if (action === "long_setup") return "border-buy text-buy bg-green-50";
  if (action === "short_setup") return "border-sell text-sell bg-red-50";
  if (action === "watch") return "border-wait text-wait bg-amber-50";
  return "border-zinc-300 text-zinc-400 bg-zinc-50";
}
function confidenceColor(action: Signal["action"]) {
  if (action === "long_setup") return "bg-buy";
  if (action === "short_setup") return "bg-sell";
  if (action === "watch") return "bg-wait";
  return "bg-zinc-300";
}
function fmt(v: number | null | undefined, d = 2) {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: d });
}
function pctStr(target: number | null | undefined, close: number) {
  if (!target) return "";
  const p = ((target - close) / close) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}
function rrRatio(signal: Signal) {
  if (!signal.tp || !signal.sl) return "";
  const r = Math.abs(signal.tp - signal.close);
  const s = Math.abs(signal.close - signal.sl);
  if (!s) return "";
  return `R:R 1:${(r / s).toFixed(1)}`;
}

export default function WatchlistCard({ signal }: { signal: Signal }) {
  const [showAlert, setShowAlert] = useState(false);

  return (
    <div className="card-lift border border-line bg-white">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-line px-4 py-3">
        <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {signal.changed && <span className="inline-block h-1.5 w-1.5 rounded-full bg-wait" />}
            <span className="font-semibold text-ink">{signal.symbol}</span>
          </div>
          <div className="mt-0.5 text-xs text-zinc-400">{signal.exchange} · {signal.timeframe}</div>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Alert button */}
          <button
            onClick={() => setShowAlert((v) => !v)}
            title="Set price alert"
            className={`flex h-7 w-7 items-center justify-center border transition-colors ${
              showAlert ? "border-amber-400 bg-amber-50 text-amber-600" : "border-line text-zinc-400 hover:border-zinc-400 hover:text-ink"
            }`}
          >
            <MoreHorizontal size={14} />
          </button>
          <WatchlistToggle
            symbol={signal.symbol}
            exchange={signal.exchange}
            timeframe={signal.timeframe}
            inWatchlist={true}
          />
        </div>
      </div>

      {/* Alert panel (inline, shown below header) */}
      {showAlert && (
        <AlertPanel
          symbol={signal.symbol}
          currentPrice={signal.close}
          onClose={() => setShowAlert(false)}
        />
      )}

      {/* Price + trend */}
      <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="block px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-xl font-semibold tabular-nums text-ink">{fmt(signal.close)}</span>
          <div className="flex items-center gap-1 text-sm">
            {signal.trend === "bearish"
              ? <TrendingDown size={15} className="text-sell" />
              : <TrendingUp size={15} className={signal.trend === "bullish" ? "text-buy" : "text-wait"} />
            }
            <span className={`capitalize text-sm ${signal.trend === "bullish" ? "text-buy" : signal.trend === "bearish" ? "text-sell" : "text-wait"}`}>
              {signal.trend}
            </span>
          </div>
        </div>

        <div className="mt-2.5 flex items-center justify-between">
          <span className={`border px-2 py-0.5 text-[11px] font-semibold ${toneFor(signal.action)}`}>
            {actionLabels[signal.action]}
          </span>
          <span className="text-xs text-zinc-400 tabular-nums">{Math.round(signal.confidence * 100)}% conf</span>
        </div>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
          <div className={`h-full rounded-full ${confidenceColor(signal.action)}`}
            style={{ width: `${Math.round(signal.confidence * 100)}%` }} />
        </div>
      </Link>

      {/* TP / SL / R:R */}
      <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="block border-t border-line px-4 py-3 space-y-1 text-xs">
        <div className="flex items-baseline gap-2">
          <span className="w-10 text-zinc-400">Entry</span>
          <span className="tabular-nums font-medium text-ink">{fmt(signal.close)}</span>
        </div>
        {signal.tp && (
          <div className="flex items-baseline gap-2">
            <span className="w-10 text-zinc-400">TP</span>
            <span className="tabular-nums font-medium text-buy">{fmt(signal.tp)}</span>
            <span className="text-buy/70 text-[10px]">{pctStr(signal.tp, signal.close)}</span>
          </div>
        )}
        {signal.sl && (
          <div className="flex items-baseline gap-2">
            <span className="w-10 text-zinc-400">SL</span>
            <span className="tabular-nums font-medium text-sell">{fmt(signal.sl)}</span>
            <span className="text-sell/70 text-[10px]">{pctStr(signal.sl, signal.close)}</span>
          </div>
        )}
        {rrRatio(signal) && (
          <div className="flex items-baseline gap-2">
            <span className="w-10 text-zinc-400">R:R</span>
            <span className="tabular-nums font-medium text-zinc-600">{rrRatio(signal)}</span>
          </div>
        )}
      </Link>
    </div>
  );
}
