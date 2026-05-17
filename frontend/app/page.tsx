import type { ReactNode } from "react";
import Link from "next/link";
import { Activity, Bell, Brain, ShieldCheck, Target, Zap } from "lucide-react";
import { getSignals, getWatchlist, getDailySummary, symbolToSlug, type Signal } from "../lib/api";
import ScanButton from "./components/ScanButton";
import SummarizeButton from "./components/SummarizeButton";
import SignalsTable from "./components/SignalsTable";
import DailyReport from "./components/DailyReport";

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
          <div className="flex gap-2">
            <SummarizeButton />
            <ScanButton />
          </div>
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

        <SignalsTable signals={signals} watchlist={watchlist} />

        {/* Sidebar */}
        <aside className="space-y-4">

          <section className="border border-line bg-white p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
                <Brain size={12} />Top Signal
              </div>
              {top && (
                top.ai_enhanced
                  ? <span className="rounded bg-buy/10 px-1.5 py-0.5 text-[10px] font-semibold text-buy">✦ AI</span>
                  : <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">Template</span>
              )}
            </div>
            <h2 className="mt-2.5 text-base font-semibold">{top?.symbol ?? "No signals"}</h2>
            {top?.ai_enhanced && top.created_at && (
              <p className="mt-0.5 text-[10px] text-zinc-400 tabular-nums">
                AI updated {new Date(top.created_at).toLocaleString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
                })}
              </p>
            )}
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
      {/* Daily IDS Report */}
      {dailySummary && (
        <div className="mx-auto max-w-7xl px-5 pb-10">
          <DailyReport summary={dailySummary.summary} date={dailySummary.date} />
        </div>
      )}
    </main>
  );
}
