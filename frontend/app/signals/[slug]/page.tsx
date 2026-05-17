import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import StrategyView from "../../components/StrategyView";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { getSignals, slugToSymbol, type Signal } from "../../../lib/api";

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, d = 2): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: d });
}

function pct(target: number | null | undefined, close: number): string {
  if (!target) return "";
  const p = ((target - close) / close) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

type Verdict = "PASS" | "WAIT" | "BLOCK" | "SKIP" | "TBD";

function deriveAnalysis(signal: Signal) {
  const ind = signal.indicators ?? {};
  const adx = ind.adx ?? 0;
  const rsi = ind.rsi ?? 50;
  const volRatio = ind.volume_ratio ?? 1;
  const ema50 = ind.ema50;
  const ema200 = ind.ema200;

  // ── Macro (derived from available indicator data) ────────────────────────
  const macroSignalParts: string[] = [];
  if (signal.trend !== "sideways") macroSignalParts.push(signal.trend === "bullish" ? "Risk-on regime" : "Risk-off regime");
  if (adx >= 20) macroSignalParts.push(`ADX ${Math.round(adx)} confirms trend`);
  else macroSignalParts.push(`ADX ${Math.round(adx)} — weak trend strength`);
  if (volRatio >= 1.3) macroSignalParts.push(`Volume ${fmt(volRatio, 1)}× above avg`);
  const macroSignal = macroSignalParts.join(" · ") || "Insufficient macro data";
  const macroVerdict: Verdict = signal.trend !== "sideways" ? "PASS" : "WAIT";

  // ── Regime ────────────────────────────────────────────────────────────────
  const regimeParts: string[] = [];
  if (ema50 != null && ema200 != null) {
    regimeParts.push(ema50 > ema200 ? "EMA50 above EMA200" : "EMA50 below EMA200");
  }
  regimeParts.push(`${signal.trend.charAt(0).toUpperCase() + signal.trend.slice(1)} trend`);
  if (adx >= 25) regimeParts.push("ADX confirms strong trend");
  else if (adx >= 20) regimeParts.push("ADX moderate");
  else regimeParts.push("ADX weak — possible range");
  const regimeSignal = regimeParts.join(" · ");
  const regimeVerdict: Verdict = signal.trend !== "sideways" ? "PASS" : adx >= 20 ? "WAIT" : "BLOCK";

  // ── Setup ─────────────────────────────────────────────────────────────────
  const setupSignal = signal.reasons.slice(0, 3).join(" · ") || signal.summary;
  const setupVerdict: Verdict =
    signal.action === "long_setup" || signal.action === "short_setup"
      ? "PASS"
      : signal.action === "watch"
        ? "WAIT"
        : "SKIP";

  // ── Catalyst ─────────────────────────────────────────────────────────────
  const catalystSignal = "Not assessed — scanner uses technical signals only · Use IDS report for catalyst layer";
  const catalystVerdict: Verdict = "TBD";

  // ── Setup score bars ──────────────────────────────────────────────────────
  const structure = signal.trend !== "sideways" ? 2 : 1;
  const pattern =
    signal.action === "long_setup" || signal.action === "short_setup"
      ? 2
      : signal.action === "watch"
        ? 1
        : 0;
  const trigger =
    signal.action === "long_setup" || signal.action === "short_setup"
      ? 3
      : signal.action === "watch"
        ? 2
        : 0;
  let confirm = 0;
  if (adx >= 25) confirm++;
  if (volRatio >= 1.3) confirm++;
  if (signal.action === "long_setup" || signal.action === "short_setup") confirm++;
  confirm = Math.min(confirm, 3);
  const setupScore = structure + pattern + trigger + confirm;

  // ── Layers passed count ───────────────────────────────────────────────────
  const verdicts = [macroVerdict, regimeVerdict, setupVerdict];
  const layersPassed = verdicts.filter((v) => v === "PASS").length;

  return {
    macro: { signal: macroSignal, verdict: macroVerdict },
    regime: { signal: regimeSignal, verdict: regimeVerdict },
    setup: { signal: setupSignal, verdict: setupVerdict },
    catalyst: { signal: catalystSignal, verdict: catalystVerdict },
    bars: { structure, pattern, trigger, confirm },
    setupScore,
    layersPassed,
  };
}

function verdictBadge(v: Verdict) {
  const styles: Record<Verdict, string> = {
    PASS: "text-buy",
    WAIT: "text-wait",
    BLOCK: "text-sell",
    SKIP: "text-zinc-400",
    TBD: "text-zinc-400",
  };
  const dots: Record<Verdict, string> = {
    PASS: "bg-buy",
    WAIT: "bg-wait",
    BLOCK: "bg-sell",
    SKIP: "bg-zinc-300",
    TBD: "bg-zinc-300",
  };
  return (
    <span className={`flex items-center gap-1.5 font-semibold ${styles[v]}`}>
      <span className={`inline-block h-2 w-2 rounded-full ${dots[v]}`} />
      {v}
    </span>
  );
}

function ProgressBar({ label, filled, total }: { label: string; filled: number; total: number }) {
  const pctWidth = Math.round((filled / total) * 100);
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-xs text-zinc-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-ink" style={{ width: `${pctWidth}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-xs tabular-nums text-zinc-500">
        {filled}/{total}
      </span>
    </div>
  );
}

function scoreLabel(score: number): string {
  if (score >= 8) return "Strong setup";
  if (score >= 6) return "Moderate — wait for trigger";
  if (score >= 4) return "Weak — not ready yet";
  return "No setup";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function SignalDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const symbol = slugToSymbol(slug);
  const signals = await getSignals();
  // Try exact match first, then case-insensitive, then partial (handles BTC/USD vs BTC/USDT)
  const signal =
    signals.find((s) => s.symbol === symbol) ??
    signals.find((s) => s.symbol.toLowerCase() === symbol.toLowerCase()) ??
    signals.find((s) => s.symbol.split("/")[0] === symbol.split("/")[0]);
  if (!signal) redirect("/");

  const analysis = deriveAnalysis(signal);
  const { bars, setupScore, layersPassed } = analysis;

  const actionLabel: Record<Signal["action"], string> = {
    long_setup: "Long setup",
    short_setup: "Short setup",
    watch: "Watch",
    no_trade: "No trade",
  };

  const verdictBoxStyle: Record<Signal["action"], string> = {
    long_setup: "bg-green-50 border-green-200",
    short_setup: "bg-red-50 border-red-100",
    watch: "bg-amber-50 border-amber-200",
    no_trade: "bg-zinc-50 border-zinc-200",
  };

  const verdictEmoji: Record<Signal["action"], string> = {
    long_setup: "🟢",
    short_setup: "🔴",
    watch: "🟡",
    no_trade: "⚫",
  };

  const actionDecision: Record<Signal["action"], string> = {
    long_setup: "GO LONG",
    short_setup: "GO SHORT",
    watch: "WAIT — รอ trigger ก่อน",
    no_trade: "NO TRADE ZONE",
  };

  const decisionMatrix: Record<Signal["action"], string> = {
    long_setup: `Score ${setupScore}/10 + Signals ALIGNED bullish · full size allowed`,
    short_setup: `Score ${setupScore}/10 + Signals ALIGNED bearish · full size allowed`,
    watch: `Score ${setupScore}/10 + Signals MIXED · wait for cleaner trigger`,
    no_trade: `Score ${setupScore}/10 + Regime sideways/weak · stay flat`,
  };

  const rr =
    signal.tp && signal.sl
      ? ((signal.tp - signal.close) / (signal.close - signal.sl)).toFixed(1)
      : null;

  return (
    <main className="min-h-screen pb-12">
      {/* Back nav */}
      <div className="border-b border-line bg-[#F7F6F0]">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-5 py-3">
          <Link
            href="/watchlist"
            className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-ink"
          >
            <ArrowLeft size={14} />
            Watchlist
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="text-sm font-medium text-ink">{signal.symbol}</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-6 space-y-5">

        {/* No AI analysis banner */}
        {!signal.ai_enhanced && (
          <div className="flex items-center gap-3 border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            <span>🤖</span>
            <span>No AI analysis yet for this signal. Click <strong className="text-ink">AI Summary</strong> on the dashboard to generate.</span>
          </div>
        )}

        {/* ── Header card ─────────────────────────────────────────────────── */}
        <div className="border border-line bg-white">
          <div className="flex items-start justify-between border-b border-line px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
                {layersPassed}/3 layers passed
              </p>
              <h2 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
                {signal.symbol}
              </h2>
              <p className="mt-0.5 text-sm text-zinc-500">
                {signal.exchange.charAt(0).toUpperCase() + signal.exchange.slice(1)} · {signal.timeframe} timeframe
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span
                className={`border px-3 py-1 text-sm font-semibold ${
                  signal.action === "long_setup"
                    ? "border-buy text-buy"
                    : signal.action === "short_setup"
                      ? "border-sell text-sell"
                      : signal.action === "watch"
                        ? "border-wait text-wait"
                        : "border-zinc-300 text-zinc-400"
                }`}
              >
                {actionLabel[signal.action]}
              </span>
              <div className="flex items-center gap-1.5">
                {signal.trend === "bearish" ? (
                  <TrendingDown size={14} className="text-sell" />
                ) : (
                  <TrendingUp size={14} className={signal.trend === "bullish" ? "text-buy" : "text-wait"} />
                )}
                <span className="text-sm capitalize text-zinc-600">{signal.trend}</span>
              </div>
            </div>
          </div>

          {/* Metric tiles */}
          <div className="grid grid-cols-2 divide-x divide-line border-b border-line sm:grid-cols-4">
            {[
              { label: "Price", value: fmt(signal.close), color: "text-ink" },
              {
                label: "TP Target",
                value: signal.tp ? fmt(signal.tp) : "—",
                sub: signal.tp ? pct(signal.tp, signal.close) : "",
                color: "text-buy",
              },
              {
                label: "SL Risk",
                value: signal.sl ? fmt(signal.sl) : "—",
                sub: signal.sl ? pct(signal.sl, signal.close) : "",
                color: "text-sell",
              },
              {
                label: "R : R",
                value: rr ? `1 : ${rr}` : "—",
                color: Number(rr) >= 2 ? "text-buy" : "text-zinc-500",
              },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="px-4 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  {label}
                </p>
                <p className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</p>
                {sub && <p className={`text-xs tabular-nums ${color} opacity-70`}>{sub}</p>}
              </div>
            ))}
          </div>

          {/* Confidence bar */}
          <div className="px-5 py-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Confidence score</span>
              <span className="tabular-nums font-medium text-zinc-600">
                {Math.round(signal.confidence * 100)}%
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${
                  signal.action === "long_setup"
                    ? "bg-buy"
                    : signal.action === "short_setup"
                      ? "bg-sell"
                      : "bg-wait"
                }`}
                style={{ width: `${Math.round(signal.confidence * 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Layer analysis table ─────────────────────────────────────────── */}
        <div className="border border-line bg-white">
          <div className="border-b border-line bg-panel px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Layer Analysis
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] uppercase tracking-wide text-zinc-400">
                <th className="px-5 py-2.5 text-left font-semibold w-24">Layer</th>
                <th className="px-3 py-2.5 text-left font-semibold">Signal</th>
                <th className="px-5 py-2.5 text-right font-semibold w-20">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {[
                { icon: "🌍", name: "Macro", data: analysis.macro },
                { icon: "🌡️", name: "Regime", data: analysis.regime },
                { icon: "🎯", name: "Setup", data: analysis.setup },
                { icon: "⚡", name: "Catalyst", data: analysis.catalyst },
              ].map(({ icon, name, data }) => (
                <tr key={name} className="hover:bg-panel/50">
                  <td className="px-5 py-3 font-semibold text-ink whitespace-nowrap">
                    {icon} {name}
                  </td>
                  <td className="px-3 py-3 text-zinc-600 leading-5">{data.signal}</td>
                  <td className="px-5 py-3 text-right">{verdictBadge(data.verdict)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Setup score + progress bars ──────────────────────────────────── */}
        <div className="border border-line bg-white px-5 py-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
            Setup Quality
          </div>
          <ProgressBar label="Structure" filled={bars.structure} total={2} />
          <ProgressBar label="Pattern" filled={bars.pattern} total={2} />
          <ProgressBar label="Trigger" filled={bars.trigger} total={3} />
          <ProgressBar label="Confirm" filled={bars.confirm} total={3} />
          <div className="pt-1 border-t border-line">
            <span className="text-sm font-semibold text-ink">
              Setup Score: {setupScore}/10
            </span>
            <span className="ml-2 text-sm text-zinc-500">— {scoreLabel(setupScore)}</span>
          </div>
        </div>

        {/* ── Strategy view ───────────────────────────────────────────────── */}
        <StrategyView signal={signal} />

        {/* ── Decision box ─────────────────────────────────────────────────── */}
        <div className={`border px-5 py-4 ${verdictBoxStyle[signal.action]}`}>
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-ink">
              {verdictEmoji[signal.action]} {actionDecision[signal.action]}
            </p>
            <div className="flex flex-col items-end gap-0.5">
              {signal.ai_enhanced
                ? <span className="rounded bg-buy/10 px-1.5 py-0.5 text-[10px] font-semibold text-buy">✦ AI</span>
                : <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">Template</span>
              }
              {signal.ai_enhanced && (
                <span className="text-[10px] text-zinc-400 tabular-nums">
                  {new Date(signal.created_at).toLocaleString("en-US", {
                    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
                  })}
                </span>
              )}
            </div>
          </div>
          <p className="mt-1 text-sm text-zinc-600">{decisionMatrix[signal.action]}</p>
          {signal.summary && (
            <p className="mt-2 text-sm leading-[1.6] text-zinc-700">{signal.summary}</p>
          )}
        </div>


        {/* ── Entry trigger + Invalidation ─────────────────────────────────── */}
        {(signal.tp || signal.sl) && (
          <div className="border border-line bg-white divide-y divide-line text-sm">
            {signal.action !== "no_trade" && (
              <div className="flex items-start gap-3 px-5 py-3">
                <span className="text-base">✅</span>
                <div>
                  <span className="font-semibold text-ink">Entry trigger:</span>{" "}
                  <span className="text-zinc-600">
                    {signal.action === "long_setup"
                      ? `Price holds above ${fmt(signal.close)} + volume confirm + MACD bullish`
                      : signal.action === "short_setup"
                        ? `Price breaks below ${fmt(signal.close)} + volume confirm + MACD bearish`
                        : `Wait for breakout with volume ≥ 1.3× avg + ADX > 25`}
                  </span>
                </div>
              </div>
            )}
            <div className="flex items-start gap-3 px-5 py-3">
              <span className="text-base">❌</span>
              <div>
                <span className="font-semibold text-ink">Invalidation:</span>{" "}
                <span className="text-zinc-600">
                  {signal.sl
                    ? `Price closes below ${fmt(signal.sl)} · setup failed · exit immediately`
                    : "EMA50 crosses below EMA200 · trend structure broken"}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Blind-spot ───────────────────────────────────────────────────── */}
        <div className="border border-amber-200 bg-amber-50 px-5 py-4 text-sm">
          <p className="font-semibold text-amber-800">
            💡 Blind-spot reminder
          </p>
          <p className="mt-1.5 leading-[1.6] text-amber-900">
            {signal.action === "long_setup" || signal.action === "short_setup"
              ? `Score ${setupScore}/10 = full size allowed. "เข้าน้อยๆ ปลอดภัย" คือ feeling ไม่ใช่ data — ถ้าจะลด size ต้องลด score ก่อน. Catalyst layer ยังไม่ได้ assess — run IDS report เพื่อ check catalyst ก่อน size เต็ม.`
              : signal.action === "watch"
                ? "WATCH ≠ no-trade — trend is real, trigger just isn't clean yet. Set an alert, don't stare at the chart. Entering early without trigger = guessing, not trading."
                : "NO TRADE is a position. The urge to do something with this chart is the trap — flat is correct here. Wait for regime to confirm before re-engaging."}
          </p>
        </div>

        {/* ── Indicators snapshot ──────────────────────────────────────────── */}
        {Object.keys(signal.indicators ?? {}).length > 0 && (
          <div className="border border-line bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
              All Indicators
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.entries(signal.indicators ?? {}).map(([key, value]) => {
                const displayKey: Record<string, string> = {
                  ema50: "EMA 50", ema200: "EMA 200", macd: "MACD",
                  macd_signal: "MACD Sig", adx: "ADX", rsi: "RSI",
                  atr: "ATR", volume_ratio: "Vol ×",
                };
                let valueColor = "text-ink";
                if (key === "rsi" && value != null) {
                  valueColor = value > 70 ? "text-sell font-bold" : value < 30 ? "text-buy font-bold" : "text-ink";
                }
                if (key === "adx" && value != null) {
                  valueColor = value >= 30 ? "text-buy" : value >= 20 ? "text-wait" : "text-zinc-500";
                }
                if (key === "volume_ratio" && value != null && value >= 1.3) valueColor = "text-buy";
                return (
                  <div key={key} className="border border-line bg-panel px-3 py-2">
                    <dt className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                      {displayKey[key] ?? key}
                    </dt>
                    <dd className={`mt-0.5 text-sm tabular-nums ${valueColor}`}>
                      {fmt(value, key === "volume_ratio" ? 2 : key === "rsi" || key === "adx" ? 1 : 2)}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
      </div>
    </main>
  );
}
