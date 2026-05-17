import Link from "next/link";
import { TrendingDown, TrendingUp, ArrowRight } from "lucide-react";
import { getSignals, symbolToSlug, type Signal } from "../../lib/api";
import ScanButton from "../components/ScanButton";

const actionLabels: Record<Signal["action"], string> = {
  long_setup: "Long setup",
  short_setup: "Short setup",
  watch: "Watch",
  no_trade: "No trade",
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

function fmt(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: digits });
}

function pctFromClose(target: number | null | undefined, close: number): string {
  if (!target) return "";
  const pct = ((target - close) / close) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

export default async function WatchlistPage() {
  const signals = await getSignals();
  const byAction: Record<string, Signal[]> = {
    long_setup: [],
    short_setup: [],
    watch: [],
    no_trade: [],
  };
  for (const s of signals) {
    byAction[s.action].push(s);
  }

  const ordered = [
    ...byAction.long_setup,
    ...byAction.short_setup,
    ...byAction.watch,
    ...byAction.no_trade,
  ];

  return (
    <main className="min-h-screen">
      {/* Page header */}
      <section className="border-b border-line bg-[#F7F6F0]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs text-zinc-400">
              {signals.length} symbol{signals.length !== 1 ? "s" : ""} tracked ·{" "}
              {byAction.long_setup.length + byAction.short_setup.length} active setup
              {byAction.long_setup.length + byAction.short_setup.length !== 1 ? "s" : ""}
            </p>
          </div>
          <ScanButton />
        </div>
      </section>

      {/* Cards grid */}
      <div className="mx-auto max-w-7xl px-5 py-6">
        {ordered.length === 0 ? (
          <div className="py-20 text-center text-sm text-zinc-500">
            No signals yet. Hit <span className="font-semibold text-ink">Scan Now</span> to run the scanner.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {ordered.map((signal) => (
              <Link
                key={`${signal.symbol}-${signal.created_at}`}
                href={`/signals/${symbolToSlug(signal.symbol)}`}
                className="group block border border-line bg-white transition-shadow hover:shadow-md"
              >
                {/* Card header */}
                <div className="flex items-start justify-between border-b border-line px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {signal.changed && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-wait" title="Changed" />
                      )}
                      <span className="font-semibold text-ink">{signal.symbol}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">
                      {signal.exchange} · {signal.timeframe}
                    </div>
                  </div>
                  <span className={`ml-2 shrink-0 border px-2 py-0.5 text-[11px] font-semibold ${toneFor(signal.action)}`}>
                    {actionLabels[signal.action]}
                  </span>
                </div>

                {/* Price + trend */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-semibold tabular-nums text-ink">
                      {fmt(signal.close)}
                    </span>
                    <div className="flex items-center gap-1 text-sm">
                      {signal.trend === "bearish" ? (
                        <TrendingDown size={15} className="text-sell" />
                      ) : (
                        <TrendingUp size={15} className={signal.trend === "bullish" ? "text-buy" : "text-wait"} />
                      )}
                      <span className={`capitalize ${signal.trend === "bullish" ? "text-buy" : signal.trend === "bearish" ? "text-sell" : "text-wait"}`}>
                        {signal.trend}
                      </span>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span>Confidence</span>
                      <span className="tabular-nums">{Math.round(signal.confidence * 100)}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full ${confidenceColor(signal.action)}`}
                        style={{ width: `${Math.round(signal.confidence * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* RSI + ADX badges */}
                  {(signal.indicators?.rsi || signal.indicators?.adx) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {signal.indicators?.rsi != null && (
                        <span className={`rounded border px-1.5 py-px text-[10px] font-medium ${
                          signal.indicators.rsi > 70
                            ? "border-red-100 bg-red-50 text-sell"
                            : signal.indicators.rsi < 30
                              ? "border-green-100 bg-green-50 text-buy"
                              : "border-zinc-200 bg-zinc-50 text-zinc-500"
                        }`}>
                          RSI {Math.round(signal.indicators.rsi)}
                        </span>
                      )}
                      {signal.indicators?.adx != null && (
                        <span className={`rounded border px-1.5 py-px text-[10px] font-medium ${
                          signal.indicators.adx >= 30
                            ? "border-green-100 bg-green-50 text-buy"
                            : signal.indicators.adx >= 20
                              ? "border-amber-100 bg-amber-50 text-wait"
                              : "border-zinc-200 bg-zinc-50 text-zinc-400"
                        }`}>
                          ADX {Math.round(signal.indicators.adx)}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* TP / SL footer */}
                <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs">
                  <div className="flex gap-3">
                    {signal.tp ? (
                      <span>
                        <span className="text-zinc-400">TP </span>
                        <span className="font-medium text-buy tabular-nums">{fmt(signal.tp)}</span>
                        <span className="ml-1 text-buy/70">{pctFromClose(signal.tp, signal.close)}</span>
                      </span>
                    ) : null}
                    {signal.sl ? (
                      <span>
                        <span className="text-zinc-400">SL </span>
                        <span className="font-medium text-sell tabular-nums">{fmt(signal.sl)}</span>
                      </span>
                    ) : null}
                    {!signal.tp && !signal.sl && <span className="text-zinc-300">No levels set</span>}
                  </div>
                  <ArrowRight size={13} className="text-zinc-300 transition-colors group-hover:text-zinc-500" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
