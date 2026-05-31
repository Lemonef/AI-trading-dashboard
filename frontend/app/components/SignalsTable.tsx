"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TrendingDown, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { symbolToSlug, type Signal } from "../../lib/api";
import WatchlistToggle from "./WatchlistToggle";

type LivePrice = { price: number; change: number; changePct: number; name: string };
type PriceMap = Record<string, LivePrice>;
type SortKey = "symbol" | "confidence" | "changePct" | "trend" | "action" | "price";
type SortDir = "asc" | "desc";
type AssetClass = "All" | "Crypto" | "Stocks" | "ETFs" | "Forex" | "Metals" | "Commodities";
type DNA = "all" | "rockstar" | "sniper" | "watcher";

function strategyVerdict(signal: Signal, dna: DNA): { label: string; color: string } | null {
  if (dna === "all") return null;
  const ind = signal.indicators ?? {};
  const adx = ind.adx ?? 0;
  const rsi = ind.rsi ?? 50;
  const vol = ind.volume_ratio ?? 0;

  if (dna === "rockstar") {
    if (signal.trend === "bullish" && adx >= 25) return { label: "🔥 GO Long", color: "border-buy text-buy" };
    if (signal.trend === "bullish") return { label: "🔥 Wait ADX", color: "border-wait text-wait" };
    if (signal.trend === "bearish" && adx >= 25) return { label: "🔥 GO Short", color: "border-sell text-sell" };
    if (signal.trend === "bearish") return { label: "🔥 Wait ADX", color: "border-wait text-wait" };
    return { label: "🔥 No trend", color: "border-zinc-300 text-zinc-400" };
  }
  if (dna === "sniper") {
    if ((signal.action === "long_setup" || signal.action === "short_setup") && vol >= 1.3)
      return { label: "🎯 FIRE", color: "border-buy text-buy" };
    if (signal.action === "long_setup" || signal.action === "short_setup")
      return { label: "🎯 Low vol", color: "border-wait text-wait" };
    if (signal.action === "watch") return { label: "🎯 Watch", color: "border-wait text-wait" };
    return { label: "🎯 No trigger", color: "border-zinc-300 text-zinc-400" };
  }
  if (dna === "watcher") {
    if (signal.trend === "bullish" && rsi < 35) return { label: "🏔️ Accumulate", color: "border-buy text-buy" };
    if (signal.trend === "bullish") return { label: "🏔️ Hold", color: "border-buy text-buy" };
    if (signal.trend === "bearish") return { label: "🏔️ Avoid", color: "border-sell text-sell" };
    return { label: "🏔️ Monitor", color: "border-zinc-300 text-zinc-400" };
  }
  return null;
}

const SPOT_METALS = new Set(["XAUUSD=X","XAGUSD=X","XPTUSD=X","XPDUSD=X"]);
const KNOWN_ETFS = new Set(["SPY","QQQ","XLE","XLK","XLF","XLV","XLI","XLB","XLU","XLP","XLY","IWM","DIA","VTI","GLD","SLV","USO","UNG","ARKK","EWY","EWT","EEM","VGK","MTUM","IEMG","EFA","FXI","VGK"]);
const METAL_FUTURES = new Set(["GC=F","SI=F","HG=F","PL=F","PA=F"]);
const OIL_FUTURES = new Set(["CL=F","BZ=F","NG=F","RB=F"]);
const AGRI_FUTURES = new Set(["ZW=F","ZC=F","ZS=F","KC=F","CT=F","SB=F","OJ=F","LE=F","HE=F"]);

function getAssetClass(symbol: string): AssetClass {
  if (symbol.includes("/")) return "Crypto";
  if (SPOT_METALS.has(symbol)) return "Metals";
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
  if (action === "long_setup") return "badge-buy";
  if (action === "short_setup") return "badge-sell";
  if (action === "watch") return "badge-wait";
  return "badge-none";
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

function parseAiScore(summary: string): { num: number; label: string } | null {
  const m = summary.match(/\*{0,2}Score:\s*(\d+)\/10\s*[—–\-]\s*(\w+)/i);
  if (!m) return null;
  return { num: parseInt(m[1], 10), label: m[2] };
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
  const router = useRouter();
  const [dna, setDna] = useState<DNA>("all");
  const [sortKey, setSortKey] = useState<SortKey>("action");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [filter, setFilter] = useState<AssetClass>("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    setDna((localStorage.getItem("investor_dna") as DNA) ?? "all");
    const onStorage = () => setDna((localStorage.getItem("investor_dna") as DNA) ?? "all");
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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
    const q = search.trim().toLowerCase();
    const base = signals
      .filter((s) => filter === "All" || getAssetClass(s.symbol) === filter)
      .filter((s) => !q || s.symbol.toLowerCase().includes(q) || (prices[s.symbol]?.name ?? "").toLowerCase().includes(q));
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
  }, [signals, prices, sortKey, sortDir, filter, search]);

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

      {/* Search + Sort bar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setSearch("")}
          placeholder="Search symbol or name…"
          className="h-8 rounded border border-line bg-white px-2.5 text-xs text-ink placeholder-zinc-400 outline-none focus:border-zinc-400 w-full sm:w-44"
        />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 ml-1">Sort</span>
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
      <div className="grid grid-cols-[1fr_0.9fr_0.9fr_auto] sm:grid-cols-[1.6fr_0.6fr_0.9fr_1.2fr_1.4fr_auto] border-b border-line bg-panel px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
        <span>Symbol</span>
        <span className="hidden sm:block">Trend</span>
        <span>Signal</span>
        <span>Price</span>
        <span className="hidden sm:block">Entry / TP / SL / R:R</span>
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
              onClick={() => router.push(`/signals/${symbolToSlug(signal.symbol)}`)}
              className="grid grid-cols-[1fr_0.9fr_0.9fr_auto] sm:grid-cols-[1.6fr_0.6fr_0.9fr_1.2fr_1.4fr_auto] items-center gap-x-2 sm:gap-x-3 border-b border-line px-4 py-3 transition-colors hover:bg-[#FAFAF7] last:border-b-0 cursor-pointer"
            >
              {/* Symbol */}
              <div className="flex min-w-0 items-start gap-2">
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
              </div>

              {/* Trend — hidden on mobile */}
              <div className="hidden sm:flex items-center gap-1">
                {signal.trend === "bearish"
                  ? <TrendingDown size={14} className="shrink-0 text-sell" />
                  : <TrendingUp size={14} className={`shrink-0 ${signal.trend === "bullish" ? "text-buy" : "text-wait"}`} />
                }
                <span className="text-xs capitalize text-zinc-600">{signal.trend}</span>
              </div>

              {/* Signal + confidence — changes with DNA selector */}
              <div>
                {(() => {
                  const sv = strategyVerdict(signal, dna);
                  return sv ? (
                    <span className={`inline-flex border px-2 py-0.5 text-[11px] font-semibold ${sv.color}`}>{sv.label}</span>
                  ) : (
                    <span className={`inline-flex border px-2 py-0.5 text-[11px] font-semibold ${toneFor(signal.action)}`}>{actionLabels[signal.action]}</span>
                  );
                })()}
                <div className="mt-1 text-[10px] text-zinc-400 tabular-nums">
                  {Math.round(signal.confidence * 100)}%
                </div>
                {signal.ai_score != null && (() => {
                  const color = signal.ai_score >= 7 ? "text-buy" : signal.ai_score >= 5 ? "text-wait" : "text-zinc-400";
                  return (
                    <div className={`mt-0.5 text-[10px] font-medium tabular-nums ${color}`}>
                      AI {signal.ai_score}/10{signal.ai_score_label ? ` — ${signal.ai_score_label}` : ""}
                    </div>
                  );
                })()}
              </div>

              {/* Live price + today % */}
              <div className="space-y-0.5">
                <div className="text-base font-semibold tabular-nums text-ink">
                  {fmt(displayPrice)}
                  {!live && <span className="ml-1 text-[10px] text-zinc-400">(scan)</span>}
                </div>
                {changePct != null && (
                  <div className={`text-xs font-medium tabular-nums ${changePct >= 0 ? "text-buy" : "text-sell"}`}>
                    {changePct >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}% today
                  </div>
                )}
              </div>

              {/* Entry / TP / SL / R:R — hidden on mobile */}
              <div className="hidden sm:block space-y-0.5 text-xs">
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
              </div>

              {/* Watchlist toggle — stopPropagation prevents row onClick */}
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
