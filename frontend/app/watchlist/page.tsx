import Link from "next/link";
import { TrendingDown, TrendingUp } from "lucide-react";
import { getSignals, getWatchlist, symbolToSlug, type Signal } from "../../lib/api";
import ScanButton from "../components/ScanButton";
import WatchlistToggle from "../components/WatchlistToggle";

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
  if (!signal.tp || !signal.sl) return "";
  const reward = Math.abs(signal.tp - signal.close);
  const risk = Math.abs(signal.close - signal.sl);
  if (!risk) return "";
  return `R:R 1:${(reward / risk).toFixed(1)}`;
}

export default async function WatchlistPage() {
  const [signals, watchlist] = await Promise.all([getSignals(), getWatchlist()]);

  const isDemo = signals.length > 0 && signals.every((s) => s.exchange === "demo");
  const lastUpdated = signals.length > 0
    ? new Date(signals[0].created_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
      })
    : null;

  // Only signals in watchlist, sorted by priority
  const watched = signals
    .filter((s) => watchlist.has(s.symbol))
    .sort((a, b) => {
      const order = ["long_setup", "short_setup", "watch", "no_trade"];
      return order.indexOf(a.action) - order.indexOf(b.action);
    });

  return (
    <main className="min-h-screen">
      {/* Page header */}
      <section className="border-b border-line bg-[#F7F6F0]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs text-zinc-400">
              {watched.length} of {signals.length} markets watched
            </p>
          </div>
          <ScanButton />
        </div>
      </section>

      {/* Banners */}
      {isDemo && (
        <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5">
          <div className="mx-auto flex max-w-7xl items-center gap-2 text-sm text-amber-800">
            <span className="font-semibold">⚠ Demo data</span>
            <span className="text-amber-600">— trigger a scan to load live market data.</span>
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

      {/* Cards */}
      <div className="mx-auto max-w-7xl px-5 py-6">
        {watched.length === 0 ? (
          <div className="rounded-sm border border-line bg-white px-8 py-16 text-center">
            <p className="text-sm font-semibold text-ink">Your watchlist is empty</p>
            <p className="mt-1 text-sm text-zinc-500">
              Go to <Link href="/" className="underline">Signals</Link> and click{" "}
              <span className="font-semibold">+</span> on any market to add it here.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {watched.map((signal) => (
              <div key={signal.symbol} className="group border border-line bg-white">
                {/* Card header */}
                <div className="flex items-start justify-between border-b border-line px-4 py-3">
                  <Link href={`/signals/${symbolToSlug(signal.symbol)}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {signal.changed && <span className="inline-block h-1.5 w-1.5 rounded-full bg-wait" />}
                      <span className="font-semibold text-ink">{signal.symbol}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">{signal.exchange} · {signal.timeframe}</div>
                  </Link>
                  <WatchlistToggle
                    symbol={signal.symbol}
                    exchange={signal.exchange}
                    timeframe={signal.timeframe}
                    inWatchlist={true}
                  />
                </div>

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

                  {/* Action badge */}
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className={`border px-2 py-0.5 text-[11px] font-semibold ${toneFor(signal.action)}`}>
                      {actionLabels[signal.action]}
                    </span>
                    <span className="text-xs text-zinc-400 tabular-nums">{Math.round(signal.confidence * 100)}% conf</span>
                  </div>

                  {/* Confidence bar */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                    <div
                      className={`h-full rounded-full ${confidenceColor(signal.action)}`}
                      style={{ width: `${Math.round(signal.confidence * 100)}%` }}
                    />
                  </div>
                </Link>

                {/* Entry / TP / SL / R:R */}
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
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
