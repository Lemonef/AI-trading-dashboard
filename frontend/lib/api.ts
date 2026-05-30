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
  // Use service role key for session queries to bypass RLS; anon key for watchlist reads
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ANON_KEY;
  const adminHdrs = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const headers = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` };
  try {
    // If session has a telegram_chat_id, merge watchlists across all linked sessions
    let sessionIds: string[] = sessionId ? [sessionId] : [];
    if (sessionId) {
      const sUrl = new URL(`${SUPABASE_URL}/rest/v1/user_sessions`);
      sUrl.searchParams.set("id", `eq.${sessionId}`);
      sUrl.searchParams.set("select", "telegram_chat_id");
      const sRes = await fetch(sUrl, { cache: "no-store", headers: adminHdrs });
      if (sRes.ok) {
        const sessions = await sRes.json();
        const tgId = sessions[0]?.telegram_chat_id;
        if (tgId) {
          const allUrl = new URL(`${SUPABASE_URL}/rest/v1/user_sessions`);
          allUrl.searchParams.set("telegram_chat_id", `eq.${tgId}`);
          allUrl.searchParams.set("select", "id");
          const allRes = await fetch(allUrl, { cache: "no-store", headers: adminHdrs });
          if (allRes.ok) {
            const rows: { id: string }[] = await allRes.json();
            sessionIds = rows.map((r) => r.id);
          }
        }
      }
    }

    const url = new URL(`${SUPABASE_URL}/rest/v1/watchlist`);
    url.searchParams.set("select", "symbol");
    if (sessionIds.length === 1) {
      url.searchParams.set("session_id", `eq.${sessionIds[0]}`);
    } else if (sessionIds.length > 1) {
      url.searchParams.set("session_id", `in.(${sessionIds.join(",")})`);
    }
    const res = await fetch(url, { cache: "no-store", headers });
    if (!res.ok) return new Set();
    const rows: { symbol: string }[] = await res.json();
    return new Set(rows.map((r) => r.symbol));
  } catch {
    return new Set();
  }
}

// ── Last discovery ────────────────────────────────────────────────────────────

export async function getLastDiscovery(): Promise<string | null> {
  if (!SUPABASE_URL || !ANON_KEY) return null;
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/market_scores`);
    url.searchParams.set("select", "scanned_at");
    url.searchParams.set("order", "scanned_at.desc");
    url.searchParams.set("limit", "1");
    const res = await fetch(url, {
      cache: "no-store",
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) return null;
    const rows: { scanned_at: string }[] = await res.json();
    return rows[0]?.scanned_at ?? null;
  } catch {
    return null;
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
