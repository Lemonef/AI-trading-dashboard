import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, Bell, Brain, ShieldCheck, Target, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { getSignals, getWatchlist, getDailySummary, symbolToSlug, type Signal } from "../lib/api";
import ScanButton from "./components/ScanButton";
import WatchlistToggle from "./components/WatchlistToggle";

const actionLabels: Record<Signal["action"], string> = {
  long_setup: "Long setup",
  short_setup: "Short setup",
  watch: "Watch",
  no_trade: "No trade",
};

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

function MetricCard({ icon, label, value, dim = false }: { icon: ReactNode; label: string; value: number; dim?: boolean }) {
  return (
    <div className="min-w-[100px] border border-line bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${dim ? "text-zinc-400" : "text-ink"}`}>{value}</div>
    </div>
  );
}

export default async function Home() {
  const [signals, watchlist, dailySummary] = await Promise.all([
    getSignals(), getWatchlist(), getDailySummary(),
  ]);

  const active = signals.filter((s) => s.action !== "no_trade");
  const changed = signals.filter((s) => s.changed);
  const activeSetups = signals.filter((s) => s.action === "long_setup" || s.action === "short_setup");
  const top = activeSetups[0] ?? active[0] ?? signals[0];
  const isDemo = signals.length > 0 && signals.every((s) => s.exchange === "demo");
  const lastUpdated = signals.length > 0
    ? new Date(signals[0].created_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
      })
    : null;

  return (
    <main className="min-h-screen">
      {/* Page header */}
      <section className="border-b border-line bg-[#F7F6F0]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <MetricCard icon={<Activity size={13} />} label="Markets" value={signals.length} dim />
            <MetricCard icon={<Target size={13} />} label="Active" value={active.length} />
            <MetricCard icon={<Bell size={13} />} label="Changed" value={changed.length} />
          </div>
          <ScanButton />
        </div>
      </section>

      {/* Data source banner */}
      {isDemo && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5">
          <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-amber-800">
            <span className="font-semibold">⚠ Demo data</span>
            <span className="text-amber-600">— backend scanner not connected. Trigger a scan to load live market data.</span>
          </div>
        </div>
      )}
      {!isDemo && lastUpdated && (
        <div className="border-b border-line bg-[#F7F6F0] px-5 py-1.5">
          <div className="mx-auto flex max-w-7xl items-center gap-2 text-xs text-zinc-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-buy" />
            Live data · last scan {lastUpdated}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1.5fr_0.5fr]">

        {/* Browse table */}
        <div className="overflow-hidden border border-line bg-white">
          <div className="border-b border-line bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Browse Markets — click row to view detail · + to add to Watchlist
          </div>
          {/* Table header */}
          <div className="grid grid-cols-[1.8fr_0.7fr_1fr_1.2fr_auto] border-b border-line bg-panel px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
            <span>Symbol</span>
            <span>Trend</span>
            <span>Signal</span>
            <span>Entry / TP / SL / R:R</span>
            <span className="w-7" />
          </div>

          {signals.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-zinc-500">
              No signals yet. Hit <span className="font-semibold text-ink">Scan Now</span>.
            </div>
          ) : (
            signals.map((signal) => {
              const inWl = watchlist.has(signal.symbol);
              const rr = rrRatio(signal);
              return (
                <div
                  key={`${signal.symbol}-${signal.created_at}`}
                  className="grid grid-cols-[1.8fr_0.7fr_1fr_1.2fr_auto] items-center gap-x-3 border-b border-line px-4 py-3 transition-colors hover:bg-[#FAFAF7] last:border-b-0"
                >
                  {/* Symbol — clickable */}
                  <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="flex min-w-0 items-start gap-2">
                    {signal.changed && (
                      <span className="mt-[6px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-wait" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-tight text-ink">{signal.symbol}</div>
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

                  {/* Signal badge + confidence */}
                  <Link href={`/signals/${symbolToSlug(signal.symbol)}`}>
                    <span className={`inline-flex border px-2 py-0.5 text-[11px] font-semibold ${toneFor(signal.action)}`}>
                      {actionLabels[signal.action]}
                    </span>
                    <div className="mt-1 text-[10px] text-zinc-400 tabular-nums">
                      {Math.round(signal.confidence * 100)}% conf
                    </div>
                  </Link>

                  {/* Entry / TP / SL / R:R */}
                  <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="space-y-0.5 text-xs">
                    <div className="flex gap-1.5 items-baseline">
                      <span className="text-zinc-400 text-[10px]">Entry</span>
                      <span className="tabular-nums font-medium text-ink">{fmt(signal.close)}</span>
                    </div>
                    {signal.tp && (
                      <div className="flex gap-1.5 items-baseline">
                        <span className="text-zinc-400 text-[10px]">TP</span>
                        <span className="tabular-nums font-medium text-buy">{fmt(signal.tp)}</span>
                        <span className="text-buy/70 text-[10px]">{pctStr(signal.tp, signal.close)}</span>
                      </div>
                    )}
                    {signal.sl && (
                      <div className="flex gap-1.5 items-baseline">
                        <span className="text-zinc-400 text-[10px]">SL</span>
                        <span className="tabular-nums font-medium text-sell">{fmt(signal.sl)}</span>
                        <span className="text-sell/70 text-[10px]">{pctStr(signal.sl, signal.close)}</span>
                      </div>
                    )}
                    {rr !== "—" && (
                      <div className="flex gap-1.5 items-baseline">
                        <span className="text-zinc-400 text-[10px]">R:R</span>
                        <span className="tabular-nums font-medium text-zinc-600">{rr}</span>
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

        {/* Sidebar */}
        <aside className="space-y-4">
          {dailySummary && (
            <section className="border border-ink bg-ink p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  <Brain size={12} />Daily Brief
                </div>
                <span className="text-[10px] text-zinc-500 tabular-nums">{dailySummary.date}</span>
              </div>
              <p className="mt-2.5 text-sm leading-[1.65] text-zinc-300">{dailySummary.summary}</p>
            </section>
          )}

          <section className="border border-line bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <Brain size={12} />Top Signal
            </div>
            <h2 className="mt-2.5 text-base font-semibold">{top?.symbol ?? "No signals"}</h2>
            <p className="mt-1.5 text-sm leading-[1.65] text-zinc-600">
              {top?.summary ?? "Run scanner to generate first read."}
            </p>
          </section>

          {activeSetups.length > 1 && (
            <section className="border border-line bg-white p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                <Zap size={12} />Active Setups
              </div>
              <ul className="mt-3 space-y-2">
                {activeSetups.map((s) => (
                  <li key={s.symbol} className="flex items-center justify-between text-sm">
                    <Link href={`/signals/${symbolToSlug(s.symbol)}`} className="font-semibold hover:underline">
                      {s.symbol}
                    </Link>
                    <span className={`border px-1.5 py-0.5 text-[11px] font-semibold ${toneFor(s.action)}`}>
                      {actionLabels[s.action]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {top && Object.keys(top.indicators ?? {}).length > 0 && (
            <section className="border border-line bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                Indicators · {top.symbol}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2">
                {Object.entries(top.indicators ?? {}).map(([key, value]) => {
                  const names: Record<string, string> = {
                    ema50: "EMA 50", ema200: "EMA 200", macd: "MACD",
                    macd_signal: "MACD Sig", adx: "ADX", rsi: "RSI",
                    atr: "ATR", volume_ratio: "Vol ×",
                  };
                  let vc = "text-ink";
                  if (key === "rsi" && value != null) vc = value > 70 ? "text-sell font-bold" : value < 30 ? "text-buy font-bold" : "text-ink";
                  if (key === "adx" && value != null) vc = value >= 30 ? "text-buy" : value >= 20 ? "text-wait" : "text-zinc-500";
                  if (key === "volume_ratio" && value != null && value >= 1.3) vc = "text-buy";
                  return (
                    <div key={key} className="border border-line bg-panel px-3 py-2">
                      <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{names[key] ?? key}</dt>
                      <dd className={`mt-0.5 text-sm tabular-nums ${vc}`}>
                        {fmt(value, key === "volume_ratio" ? 2 : key === "rsi" || key === "adx" ? 1 : 2)}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          )}

          <section className="border border-line bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <ShieldCheck size={12} />Execution Guard
            </div>
            <p className="mt-2.5 text-sm leading-[1.65] text-zinc-600">
              Scanner and alerts live. Execution locked until confirm button + order review endpoint added.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
