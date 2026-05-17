"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { TrendingDown, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { symbolToSlug, type Signal } from "../../lib/api";
import WatchlistToggle from "./WatchlistToggle";

type LivePrice = { price: number; change: number; changePct: number; name: string };
type PriceMap = Record<string, LivePrice>;
type SortKey = "symbol" | "confidence" | "changePct" | "trend" | "action" | "price";
type SortDir = "asc" | "desc";
type AssetClass = "All" | "Crypto" | "Stocks" | "ETFs" | "Forex" | "Metals" | "Commodities";

const KNOWN_ETFS = new Set(["SPY","QQQ","XLE","XLK","XLF","XLV","XLI","XLB","XLU","XLP","XLY","IWM","DIA","VTI","GLD","SLV","USO","UNG","ARKK","EWY","EWT","EEM","VGK","MTUM","IEMG","EFA","FXI","VGK"]);
const METAL_FUTURES = new Set(["GC=F","SI=F","HG=F","PL=F","PA=F"]);
const OIL_FUTURES = new Set(["CL=F","BZ=F","NG=F","RB=F"]);
const AGRI_FUTURES = new Set(["ZW=F","ZC=F","ZS=F","KC=F","CT=F","SB=F","OJ=F","LE=F","HE=F"]);

function getAssetClass(symbol: string): AssetClass {
  if (symbol.includes("/")) return "Crypto";
  if (symbol.endsWith("=X")) return "Forex";
  if (METAL_FUTURES.has(symbol)) return "Metals";
  if (OIL_FUTURES.has(symbol)) return "Commodities";
  if (AGRI_FUTURES.has(symbol)) return "Commodities";
  if (symbol.endsWith("=F")) return "Commodities";
  if (KNOWN_ETFS.has(symbol)) return "ETFs";
  return "Stocks";
}


const actionLabels: Record<Signal["action"], string> = {
  long_setup: "Long setup",
  short_setup: "Short setup",
  watch: "Watch",
  no_trade: "No trade",
};

const actionOrder: Record<Signal["action"], number> = {
  long_setup: 0, short_setup: 1, watch: 2, no_trade: 3,
};
const trendOrder: Record<string, number> = { bullish: 0, sideways: 1, bearish: 2 };

function toneFor(action: Signal["action"]) {
  if (action === "long_setup") return "border-buy text-buy";
  if (action === "short_setup") return "border-sell text-sell";
  if (action === "watch") return "border-wait text-wait";
  return "border-zinc-300 text-zinc-400";
}

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: d });
}

function pctStr(target: number | null | undefined, close: number): string {
  if (!target) return "";
  const p = ((target - close) / close) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

function rrRatio(signal: Signal): string {
  if (!signal.tp || !signal.sl) return "—";
  const reward = Math.abs(signal.tp - signal.close);
  const risk = Math.abs(signal.close - signal.sl);
  if (!risk) return "—";
  return `1 : ${(reward / risk).toFixed(1)}`;
}

export default function SignalsTable({
  signals,
  watchlist,
}: {
  signals: Signal[];
  watchlist: Set<string>;
}) {
  const [prices, setPrices] = useState<PriceMap>({});
  const [fetching, setFetching] = useState(false);
  const [lastFetch, setLastFetch] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("action");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState<AssetClass>("All");

  const fetchPrices = useCallback(async () => {
    if (!signals.length) return;
    setFetching(true);
    try {
      const syms = signals.map((s) => s.symbol).join(",");
      const res = await fetch(`/api/prices?symbols=${encodeURIComponent(syms)}`);
      if (res.ok) {
        const data: PriceMap = await res.json();
        setPrices(data);
        setLastFetch(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }));
      }
    } finally {
      setFetching(false);
    }
  }, [signals]);

  useEffect(() => {
    fetchPrices();
    const id = setInterval(fetchPrices, 60_000);
    return () => clearInterval(id);
  }, [fetchPrices]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "confidence" || key === "changePct" ? "desc" : "asc");
    }
  }

  const availableClasses = useMemo<AssetClass[]>(() => {
    const found = new Set<AssetClass>(signals.map((s) => getAssetClass(s.symbol)));
    const order: AssetClass[] = ["All", "Crypto", "Stocks", "ETFs", "Forex", "Metals", "Commodities"];
    return order.filter((c) => c === "All" || found.has(c));
  }, [signals]);

  const sorted = useMemo(() => {
    const base = filter === "All" ? signals : signals.filter((s) => getAssetClass(s.symbol) === filter);
    return [...base].sort((a, b) => {
      let cmp = 0;
      if (sortKey === "symbol") cmp = a.symbol.localeCompare(b.symbol);
      else if (sortKey === "confidence") cmp = a.confidence - b.confidence;
      else if (sortKey === "price") {
        const pa = prices[a.symbol]?.price ?? a.close;
        const pb = prices[b.symbol]?.price ?? b.close;
        cmp = pa - pb;
      }
      else if (sortKey === "changePct") {
        const ca = prices[a.symbol]?.changePct ?? 0;
        const cb = prices[b.symbol]?.changePct ?? 0;
        cmp = ca - cb;
      }
      else if (sortKey === "trend") cmp = (trendOrder[a.trend] ?? 1) - (trendOrder[b.trend] ?? 1);
      else if (sortKey === "action") cmp = actionOrder[a.action] - actionOrder[b.action];
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [signals, prices, sortKey, sortDir, filter]);

  function SortBtn({ label, k }: { label: string; k: SortKey }) {
    const active = sortKey === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors ${
          active
            ? "border-ink bg-ink text-white"
            : "border-line bg-white text-zinc-500 hover:border-zinc-400 hover:text-ink"
        }`}
      >
        {label}
        {active ? (
          sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />
        ) : (
          <ArrowUpDown size={10} className="opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="overflow-hidden border border-line bg-white">
      {/* Asset class filter chips */}
      {availableClasses.length > 1 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line bg-[#F7F6F0] px-4 py-2.5">
          {availableClasses.map((cls) => (
            <button
              key={cls}
              onClick={() => setFilter(cls)}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                filter === cls
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-zinc-500 hover:border-zinc-400 hover:text-ink"
              }`}
            >
              {cls}
              {cls !== "All" && (
                <span className="ml-1 opacity-60">
                  {signals.filter((s) => getAssetClass(s.symbol) === cls).length}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Sort bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 mr-1">Sort</span>
        <SortBtn label="Signal" k="action" />
        <SortBtn label="Score" k="confidence" />
        <SortBtn label="Today %" k="changePct" />
        <SortBtn label="Trend" k="trend" />
        <SortBtn label="Price" k="price" />
        <SortBtn label="Symbol" k="symbol" />
        <div className="ml-auto flex items-center gap-2">
          {lastFetch && (
            <span className="text-[10px] text-zinc-400">Live · {lastFetch}</span>
          )}
          <button
            onClick={fetchPrices}
            disabled={fetching}
            className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-ink disabled:opacity-40"
          >
            <RefreshCw size={11} className={fetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[1.6fr_0.6fr_0.9fr_1.2fr_1.4fr_auto] border-b border-line bg-panel px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        <span>Symbol</span>
        <span>Trend</span>
        <span>Signal</span>
        <span>Live Price</span>
        <span>Entry / TP / SL / R:R</span>
        <span className="w-7" />
      </div>

      {sorted.length === 0 ? (
        <div className="px-6 py-14 text-center text-sm text-zinc-500">
          No signals yet. Hit <span className="font-semibold text-ink">Scan Now</span>.
        </div>
      ) : (
        sorted.map((signal) => {
          const live = prices[signal.symbol];
          const inWl = watchlist.has(signal.symbol);
          const displayPrice = live?.price ?? signal.close;
          const changePct = live?.changePct;

          return (
            <div
              key={`${signal.symbol}-${signal.created_at}`}
              className="grid grid-cols-[1.6fr_0.6fr_0.9fr_1.2fr_1.4fr_auto] items-center gap-x-3 border-b border-line px-4 py-3 transition-colors hover:bg-[#FAFAF7] last:border-b-0"
            >
              {/* Symbol */}
              <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="flex min-w-0 items-start gap-2">
                {signal.changed && (
                  <span className="mt-[5px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-wait" />
                )}
                <div className="min-w-0">
                  <div className="truncate font-semibold leading-tight text-ink">{signal.symbol}</div>
                  {live?.name && live.name !== signal.symbol && (
                    <div className="mt-0.5 truncate text-[10px] text-zinc-400">{live.name}</div>
                  )}
                  <div className="mt-0.5 text-[10px] text-zinc-400">
                    {signal.exchange} · {signal.timeframe}
                  </div>
                </div>
              </Link>

              {/* Trend */}
              <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="flex items-center gap-1">
                {signal.trend === "bearish"
                  ? <TrendingDown size={14} className="shrink-0 text-sell" />
                  : <TrendingUp size={14} className={`shrink-0 ${signal.trend === "bullish" ? "text-buy" : "text-wait"}`} />
                }
                <span className="text-xs capitalize text-zinc-600">{signal.trend}</span>
              </Link>

              {/* Signal + confidence */}
              <Link href={`/signals/${symbolToSlug(signal.symbol)}`}>
                <span className={`inline-flex border px-2 py-0.5 text-[11px] font-semibold ${toneFor(signal.action)}`}>
                  {actionLabels[signal.action]}
                </span>
                <div className="mt-1 text-[10px] text-zinc-400 tabular-nums">
                  {Math.round(signal.confidence * 100)}%
                </div>
              </Link>

              {/* Live price + today % */}
              <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="space-y-0.5">
                <div className="text-base font-semibold tabular-nums text-ink">
                  {fmt(displayPrice)}
                  {!live && <span className="ml-1 text-[10px] text-zinc-400">(scan)</span>}
                </div>
                {changePct != null && (
                  <div className={`text-xs font-medium tabular-nums ${changePct >= 0 ? "text-buy" : "text-sell"}`}>
                    {changePct >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}% today
                  </div>
                )}
              </Link>

              {/* Entry / TP / SL / R:R */}
              <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="space-y-0.5 text-xs">
                <div className="flex gap-1.5 items-baseline">
                  <span className="text-[10px] text-zinc-400 w-8">Entry</span>
                  <span className="tabular-nums font-medium text-ink">{fmt(signal.close)}</span>
                </div>
                {signal.tp && (
                  <div className="flex gap-1.5 items-baseline">
                    <span className="text-[10px] text-zinc-400 w-8">TP</span>
                    <span className="tabular-nums font-medium text-buy">{fmt(signal.tp)}</span>
                    <span className="text-[10px] text-buy/70">{pctStr(signal.tp, signal.close)}</span>
                  </div>
                )}
                {signal.sl && (
                  <div className="flex gap-1.5 items-baseline">
                    <span className="text-[10px] text-zinc-400 w-8">SL</span>
                    <span className="tabular-nums font-medium text-sell">{fmt(signal.sl)}</span>
                    <span className="text-[10px] text-sell/70">{pctStr(signal.sl, signal.close)}</span>
                  </div>
                )}
                {rrRatio(signal) !== "—" && (
                  <div className="flex gap-1.5 items-baseline">
                    <span className="text-[10px] text-zinc-400 w-8">R:R</span>
                    <span className="tabular-nums font-medium text-zinc-600">{rrRatio(signal)}</span>
                  </div>
                )}
              </Link>

              {/* Watchlist toggle */}
              <WatchlistToggle
                symbol={signal.symbol}
                exchange={signal.exchange}
                timeframe={signal.timeframe}
                inWatchlist={inWl}
              />
            </div>
          );
        })
      )}
    </div>
  );
}
