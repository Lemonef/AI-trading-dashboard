export type { Signal, PriceAlert, DailySummary } from "./types";

import { SUPABASE_URL, ANON_KEY } from "./supabase";
import type { Signal, DailySummary } from "./types";

// ── URL helpers ───────────────────────────────────────────────────────────────

export function symbolToSlug(symbol: string): string {
  return symbol.replace(/\//g, "--").replace(/=/g, "__");
}

export function slugToSymbol(slug: string): string {
  return slug.replace(/--/g, "/").replace(/__/g, "=");
}

// ── Signals ───────────────────────────────────────────────────────────────────

export async function getSignals(): Promise<Signal[]> {
  const supabaseSignals = await getSupabaseSignals();
  if (supabaseSignals.length > 0) return supabaseSignals;

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  try {
    if (!apiUrl) throw new Error("no API URL");
    const res = await fetch(`${apiUrl}/api/signals`, { cache: "no-store" });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  } catch {
    return [demoSignal()];
  }
}

async function getSupabaseSignals(): Promise<Signal[]> {
  if (!SUPABASE_URL || !ANON_KEY) return [];
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/signals`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "200");
    const res = await fetch(url, {
      cache: "no-store",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) return [];
    const rows: Signal[] = await res.json();
    const seen = new Set<string>();
    return rows.filter((s) => {
      const key = `${s.symbol}:${s.timeframe}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } catch {
    return [];
  }
}

function demoSignal(): Signal {
  return {
    symbol: "BTC/USDT", exchange: "demo", timeframe: "1d", close: 104250,
    trend: "bullish", action: "long_setup", confidence: 0.74,
    summary: "Demo signal. Start the backend scanner to replace this with live market data.",
    tp: 111950, sl: 99880, changed: true, created_at: new Date().toISOString(),
    indicators: { ema50: 101100, ema200: 88900, rsi: 58.6, adx: 26.2, atr: 2180, macd: 1160 },
    reasons: ["EMA50 above EMA200", "ADX confirms trend", "Breakout watch"],
  };
}

// ── Watchlist ─────────────────────────────────────────────────────────────────

export async function getWatchlist(sessionId?: string | null): Promise<Set<string>> {
  if (!SUPABASE_URL || !ANON_KEY) return new Set();
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/watchlist`);
    url.searchParams.set("select", "symbol");
    if (sessionId) url.searchParams.set("session_id", `eq.${sessionId}`);
    const res = await fetch(url, {
      cache: "no-store",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) return new Set();
    const rows: { symbol: string }[] = await res.json();
    return new Set(rows.map((r) => r.symbol));
  } catch {
    return new Set();
  }
}

// ── Daily summary ─────────────────────────────────────────────────────────────

export async function getDailySummary(): Promise<DailySummary | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/daily_summaries`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "date.desc");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      cache: "no-store",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows: DailySummary[] = await res.json();
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
