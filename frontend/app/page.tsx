import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { Activity, Bell, ShieldCheck, Target } from "lucide-react";
import { getSignals, getWatchlist, getDailySummary, type Signal } from "../lib/api";
import ScanButton from "./components/ScanButton";
import SummarizeButton from "./components/SummarizeButton";
import SignalsTable from "./components/SignalsTable";
import DailyReport from "./components/DailyReport";
import DnaSelector from "./components/DnaSelector";
import TopMarketsPanel from "./components/TopMarketsPanel";
import DiscoverButton from "./components/DiscoverButton";

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


function MetricCard({ icon, label, value, dim = false }: { icon: ReactNode; label: string; value: number; dim?: boolean }) {
  return (
    <div className="card-lift min-w-[100px] border border-line bg-surface px-4 py-3 shadow-sm">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">{icon}{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${dim ? "text-zinc-400" : "text-ink"}`}>{value}</div>
    </div>
  );
}

export default async function Home() {
  const sessionId = (await cookies()).get("session_id")?.value ?? null;
  const [signals, watchlist, dailySummary] = await Promise.all([
    getSignals(), getWatchlist(sessionId), getDailySummary(),
  ]);

  const active = signals.filter((s) => s.action !== "no_trade");
  const changed = signals.filter((s) => s.changed);
const isDemo = signals.length > 0 && signals.every((s) => s.exchange === "demo");
  const lastUpdated = signals.length > 0
    ? new Date(signals[0].created_at).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
        timeZone: "Asia/Bangkok",
      })
    : null;
  const lastAiSummary = (dailySummary?.updated_at ?? dailySummary?.created_at)
    ? new Date((dailySummary!.updated_at ?? dailySummary!.created_at)!).toLocaleString("en-US", {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
        timeZone: "Asia/Bangkok",
      })
    : null;

  return (
    <main className="min-h-screen">
      {/* Page header */}
      <section className="border-b border-line" style={{ background: "linear-gradient(180deg, #F6F5F0 0%, #F0EEE8 100%)" }}>
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <MetricCard icon={<Activity size={13} />} label="Markets" value={signals.length} dim />
            <MetricCard icon={<Target size={13} />} label="Active" value={active.length} />
            <MetricCard icon={<Bell size={13} />} label="Changed" value={changed.length} />
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <DnaSelector />
            <SummarizeButton />
            <DiscoverButton />
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
          <div className="mx-auto flex max-w-7xl items-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-buy" />
              Last scan {lastUpdated}
            </span>
            {lastAiSummary && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                Last AI summary {lastAiSummary}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Body */}
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-6 lg:grid-cols-[1.5fr_0.5fr]">

        <SignalsTable signals={signals} watchlist={watchlist} />

        {/* Sidebar */}
        <aside className="space-y-4 stagger">

          <TopMarketsPanel signals={signals} />

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
