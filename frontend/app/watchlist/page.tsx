import { getSignals, getWatchlist } from "../../lib/api";
import ScanButton from "../components/ScanButton";
import WatchlistCard from "../components/WatchlistCard";


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
              <WatchlistCard key={signal.symbol} signal={signal} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
