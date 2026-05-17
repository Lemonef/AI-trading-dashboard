import { Activity, Bell, Brain, ShieldCheck, Target, TrendingDown, TrendingUp } from "lucide-react";
import { getSignals, type Signal } from "../lib/api";

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
  return "border-zinc-500 text-zinc-600";
}

function fmt(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export default async function Home() {
  const signals = await getSignals();
  const active = signals.filter((signal) => signal.action !== "no_trade").length;
  const changed = signals.filter((signal) => signal.changed).length;
  const top = signals[0];

  return (
    <main className="min-h-screen">
      <section className="border-b border-line bg-[#F7F6F0]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-600">AI assisted, user confirmed</p>
            <h1 className="mt-2 text-3xl font-semibold text-ink md:text-5xl">Trading Signal Desk</h1>
          </div>
          <div className="grid metric-grid gap-3 md:min-w-[520px]">
            <div className="border border-line bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-zinc-600"><Activity size={16} />Watchlist</div>
              <div className="mt-1 text-2xl font-semibold">{signals.length}</div>
            </div>
            <div className="border border-line bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-zinc-600"><Target size={16} />Active setups</div>
              <div className="mt-1 text-2xl font-semibold">{active}</div>
            </div>
            <div className="border border-line bg-white px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-zinc-600"><Bell size={16} />Changed</div>
              <div className="mt-1 text-2xl font-semibold">{changed}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden border border-line bg-white">
          <div className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr] border-b border-line bg-panel px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600 md:grid-cols-[1fr_0.7fr_0.7fr_0.7fr_1.2fr]">
            <span>Market</span>
            <span>Trend</span>
            <span>Action</span>
            <span>Risk</span>
            <span className="hidden md:block">Reason</span>
          </div>
          {signals.map((signal) => (
            <article key={`${signal.symbol}-${signal.created_at}`} className="grid grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr] gap-2 border-b border-line px-4 py-4 last:border-b-0 md:grid-cols-[1fr_0.7fr_0.7fr_0.7fr_1.2fr]">
              <div>
                <div className="font-semibold">{signal.symbol}</div>
                <div className="mt-1 text-sm text-zinc-600">{signal.exchange} / {signal.timeframe} / {fmt(signal.close)}</div>
              </div>
              <div className="flex items-start gap-2 capitalize">
                {signal.trend === "bearish" ? <TrendingDown size={18} className="text-sell" /> : <TrendingUp size={18} className={signal.trend === "bullish" ? "text-buy" : "text-wait"} />}
                <span>{signal.trend}</span>
              </div>
              <div>
                <span className={`inline-flex border px-2 py-1 text-sm font-semibold ${toneFor(signal)}`}>{actionLabels[signal.action]}</span>
                <div className="mt-1 text-xs text-zinc-500">{Math.round(signal.confidence * 100)}% confidence</div>
              </div>
              <div className="text-sm">
                <div>TP {fmt(signal.tp)}</div>
                <div>SL {fmt(signal.sl)}</div>
              </div>
              <div className="hidden text-sm text-zinc-700 md:block">
                {signal.reasons.slice(0, 2).join(" / ") || signal.summary}
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-5">
          <section className="border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-600"><Brain size={16} />AI Summary</div>
            <h2 className="mt-3 text-xl font-semibold">{top?.symbol ?? "No signals yet"}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-700">{top?.summary ?? "Run the scanner to generate the first market read."}</p>
          </section>

          <section className="border border-line bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-600"><ShieldCheck size={16} />Execution Guard</div>
            <p className="mt-3 text-sm leading-6 text-zinc-700">
              Scanner and alerts are enabled. Trading execution is intentionally absent until a confirm button and backend order review endpoint are added.
            </p>
          </section>

          <section className="border border-line bg-white p-4">
            <div className="text-sm font-semibold uppercase tracking-[0.12em] text-zinc-600">Indicator Snapshot</div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              {Object.entries(top?.indicators ?? {}).map(([key, value]) => (
                <div key={key} className="border border-line bg-panel px-3 py-2">
                  <dt className="uppercase text-zinc-500">{key}</dt>
                  <dd className="mt-1 font-semibold">{fmt(value)}</dd>
                </div>
              ))}
            </dl>
          </section>
        </aside>
      </section>
    </main>
  );
}
