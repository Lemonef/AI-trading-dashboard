import type { ReactNode } from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  Brain,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { getSignals, getDailySummary, symbolToSlug, type Signal } from "../lib/api";
import ScanButton from "./components/ScanButton";

const actionLabels: Record<Signal["action"], string> = {
  long_setup: "Long setup",
  short_setup: "Short setup",
  watch: "Watch",
  no_trade: "No trade",
};

function toneFor(signal: Signal) {
  if (signal.action === "long_setup") return "border-buy text-buy";
  if (signal.action === "short_setup") return "border-sell text-sell";
  if (signal.action === "watch") return "border-wait text-wait";
  return "border-zinc-300 text-zinc-400";
}

function confidenceBar(signal: Signal) {
  const pct = Math.round(signal.confidence * 100);
  const color =
    signal.action === "long_setup"
      ? "bg-buy"
      : signal.action === "short_setup"
        ? "bg-sell"
        : "bg-wait";
  return { pct, color };
}

function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function rsiBadge(rsi: number | null | undefined) {
  if (!rsi) return null;
  const val = Math.round(rsi);
  const color =
    rsi > 70
      ? "text-sell bg-red-50 border-red-100"
      : rsi < 30
        ? "text-buy bg-green-50 border-green-100"
        : "text-zinc-500 bg-zinc-50 border-zinc-200";
  return { val, color };
}

function adxBadge(adx: number | null | undefined) {
  if (!adx) return null;
  const val = Math.round(adx);
  const color =
    adx >= 30
      ? "text-buy bg-green-50 border-green-100"
      : adx >= 20
        ? "text-wait bg-amber-50 border-amber-100"
        : "text-zinc-400 bg-zinc-50 border-zinc-200";
  return { val, color };
}

function indicatorValueColor(key: string, value: number): string {
  if (key === "rsi") {
    if (value > 70) return "text-sell font-bold";
    if (value < 30) return "text-buy font-bold";
  }
  if (key === "adx") {
    if (value >= 30) return "text-buy";
    if (value >= 20) return "text-wait";
    return "text-zinc-500";
  }
  if (key === "volume_ratio" && value >= 1.3) return "text-buy";
  return "text-ink";
}

const indicatorDisplayName: Record<string, string> = {
  ema50: "EMA 50",
  ema200: "EMA 200",
  macd: "MACD",
  macd_signal: "MACD Sig",
  adx: "ADX",
  rsi: "RSI",
  atr: "ATR",
  volume_ratio: "Vol ×",
};

function MetricCard({
  icon,
  label,
  value,
  dim = false,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  dim?: boolean;
}) {
  return (
    <div className="min-w-[100px] border border-line bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${dim ? "text-zinc-400" : "text-ink"}`}>
        {value}
      </div>
    </div>
  );
}

export default async function Home() {
  const [signals, dailySummary] = await Promise.all([getSignals(), getDailySummary()]);
  const isDemo = signals.length > 0 && signals.every((s) => s.exchange === "demo");
  const lastUpdated = signals.length > 0
    ? new Date(signals[0].created_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
      })
    : null;
  const active = signals.filter((s) => s.action !== "no_trade");
  const changed = signals.filter((s) => s.changed);
  const activeSetups = signals.filter(
    (s) => s.action === "long_setup" || s.action === "short_setup",
  );
  const top = activeSetups[0] ?? active[0] ?? signals[0];

  return (
    <main className="min-h-screen">
      {/* Page header */}
      <section className="border-b border-line bg-[#F7F6F0]">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <MetricCard icon={<Activity size={13} />} label="Watchlist" value={signals.length} dim />
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
            <span className="text-amber-600">— backend scanner not connected. Start the backend or configure Supabase to see live signals.</span>
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
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1.4fr_0.6fr]">
        {/* Signal table */}
        <div className="overflow-hidden border border-line bg-white">
          <div className="grid grid-cols-[1.2fr_0.65fr_1.1fr_0.75fr] border-b border-line bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400 md:grid-cols-[1.1fr_0.6fr_1.1fr_0.7fr_1.2fr]">
            <span>Market</span>
            <span>Trend</span>
            <span>Signal</span>
            <span>Risk</span>
            <span className="hidden md:block">Reason</span>
          </div>

          {signals.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-zinc-500">
              No signals yet.{" "}
              <span className="font-semibold text-ink">Hit Scan Now</span> to run the scanner.
            </div>
          ) : (
            signals.map((signal) => {
              const { pct, color } = confidenceBar(signal);
              const rsi = rsiBadge(signal.indicators?.rsi);
              const adx = adxBadge(signal.indicators?.adx);
              return (
                <Link
                  key={`${signal.symbol}-${signal.created_at}`}
                  href={`/signals/${symbolToSlug(signal.symbol)}`}
                  className="grid grid-cols-[1.2fr_0.65fr_1.1fr_0.75fr] gap-x-3 border-b border-line px-4 py-4 transition-colors hover:bg-[#FAFAF7] last:border-b-0 md:grid-cols-[1.1fr_0.6fr_1.1fr_0.7fr_1.2fr] cursor-pointer"
                >
                  <div className="flex min-w-0 items-start gap-2">
                    {signal.changed && (
                      <span className="mt-[7px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-wait" title="Signal changed" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-semibold leading-tight">{signal.symbol}</div>
                      <div className="mt-0.5 text-xs text-zinc-400">
                        {signal.exchange} · {signal.timeframe} ·{" "}
                        <span className="tabular-nums">{fmt(signal.close)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-1.5 pt-0.5">
                    {signal.trend === "bearish" ? (
                      <TrendingDown size={15} className="mt-0.5 shrink-0 text-sell" />
                    ) : (
                      <TrendingUp size={15} className={`mt-0.5 shrink-0 ${signal.trend === "bullish" ? "text-buy" : "text-wait"}`} />
                    )}
                    <span className="text-sm capitalize text-zinc-700">{signal.trend}</span>
                  </div>

                  <div>
                    <span className={`inline-flex border px-2 py-0.5 text-xs font-semibold ${toneFor(signal)}`}>
                      {actionLabels[signal.action]}
                    </span>
                    <div className="mt-1.5 h-[3px] w-full max-w-[72px] overflow-hidden rounded-full bg-line">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {rsi && (
                        <span className={`rounded border px-1 py-px text-[10px] font-medium ${rsi.color}`}>
                          RSI {rsi.val}
                        </span>
                      )}
                      {adx && (
                        <span className={`rounded border px-1 py-px text-[10px] font-medium ${adx.color}`}>
                          ADX {adx.val}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-0.5 text-sm">
                    {signal.tp ? (
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-medium uppercase text-zinc-400">TP</span>
                        <span className="tabular-nums font-medium text-buy">{fmt(signal.tp)}</span>
                      </div>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                    {signal.sl && (
                      <div className="flex items-baseline gap-1">
                        <span className="text-[10px] font-medium uppercase text-zinc-400">SL</span>
                        <span className="tabular-nums font-medium text-sell">{fmt(signal.sl)}</span>
                      </div>
                    )}
                  </div>

                  <div className="hidden text-sm leading-5 text-zinc-600 md:block">
                    {signal.reasons.slice(0, 2).join(" · ") || signal.summary}
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          {/* Claude daily summary */}
          {dailySummary && (
            <section className="border border-ink bg-ink p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                  <Brain size={12} />Claude Daily Brief
                </div>
                <span className="text-[10px] text-zinc-500 tabular-nums">{dailySummary.date}</span>
              </div>
              <p className="mt-2.5 text-sm leading-[1.65] text-zinc-300">{dailySummary.summary}</p>
            </section>
          )}

          <section className="border border-line bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <Brain size={12} />Signal Summary
            </div>
            <h2 className="mt-2.5 text-base font-semibold">{top?.symbol ?? "No signals"}</h2>
            <p className="mt-1.5 text-sm leading-[1.65] text-zinc-600">
              {top?.summary ?? "Run the scanner to generate the first market read."}
            </p>
          </section>

          {activeSetups.length > 1 && (
            <section className="border border-line bg-white p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                <Zap size={12} />Active Setups
              </div>
              <ul className="mt-3 space-y-2.5">
                {activeSetups.map((s) => (
                  <li key={s.symbol} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-semibold">{s.symbol}</span>
                      <span className="ml-1.5 text-xs text-zinc-400">{fmt(s.confidence * 100, 0)}%</span>
                    </div>
                    <span className={`border px-1.5 py-0.5 text-xs font-semibold ${toneFor(s)}`}>
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
                {Object.entries(top.indicators ?? {}).map(([key, value]) => (
                  <div key={key} className="border border-line bg-panel px-3 py-2">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                      {indicatorDisplayName[key] ?? key}
                    </dt>
                    <dd className={`mt-0.5 text-sm tabular-nums ${value !== null && value !== undefined ? indicatorValueColor(key, value) : "text-zinc-400"}`}>
                      {fmt(value, key === "volume_ratio" ? 2 : key === "rsi" || key === "adx" ? 1 : 2)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <section className="border border-line bg-white p-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
              <ShieldCheck size={12} />Execution Guard
            </div>
            <p className="mt-2.5 text-sm leading-[1.65] text-zinc-600">
              Scanner and alerts are live. Order execution locked until confirm button + order review endpoint are added.
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
