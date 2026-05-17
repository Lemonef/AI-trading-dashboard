export function symbolToSlug(symbol: string): string {
  return symbol.replace(/\//g, "--");
}

export function slugToSymbol(slug: string): string {
  return slug.replace(/--/g, "/");
}

export type Signal = {
  id?: string;
  symbol: string;
  exchange: string;
  timeframe: string;
  close: number;
  trend: "bullish" | "bearish" | "sideways";
  action: "watch" | "long_setup" | "short_setup" | "no_trade";
  confidence: number;
  summary: string;
  tp: number | null;
  sl: number | null;
  changed: boolean;
  created_at: string;
  indicators: Record<string, number | null>;
  reasons: string[];
};

export async function getSignals(): Promise<Signal[]> {
  const supabaseSignals = await getSupabaseSignals();
  if (supabaseSignals.length > 0) {
    return supabaseSignals;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  try {
    if (!apiUrl) {
      throw new Error("No backend API URL configured");
    }
    const response = await fetch(`${apiUrl}/api/signals`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    return response.json();
  } catch {
    return [
      {
        symbol: "BTC/USDT",
        exchange: "demo",
        timeframe: "1d",
        close: 104250,
        trend: "bullish",
        action: "long_setup",
        confidence: 0.74,
        summary: "Demo signal. Start the backend scanner to replace this with live market data.",
        tp: 111950,
        sl: 99880,
        changed: true,
        created_at: new Date().toISOString(),
        indicators: {
          ema50: 101100,
          ema200: 88900,
          rsi: 58.6,
          adx: 26.2,
          atr: 2180,
          macd: 1160,
        },
        reasons: ["EMA50 above EMA200", "ADX confirms trend", "Breakout watch"],
      },
    ];
  }
}

async function getSupabaseSignals(): Promise<Signal[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return [];
  }

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/signals`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "50");

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase returned ${response.status}`);
    }

    const rows: Signal[] = await response.json();
    // Keep only the latest signal per symbol (rows already ordered desc)
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

export async function getWatchlist(): Promise<Set<string>> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return new Set();
  try {
    const url = new URL(`${supabaseUrl}/rest/v1/watchlist`);
    url.searchParams.set("select", "symbol");
    const res = await fetch(url, {
      cache: "no-store",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!res.ok) return new Set();
    const rows: { symbol: string }[] = await res.json();
    return new Set(rows.map((r) => r.symbol));
  } catch {
    return new Set();
  }
}

export type DailySummary = {
  date: string;
  summary: string;
  signals_count: number;
  created_at: string;
};

export async function getDailySummary(): Promise<DailySummary | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/daily_summaries`);
    url.searchParams.set("select", "*");
    url.searchParams.set("order", "date.desc");
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      cache: "no-store",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!response.ok) return null;
    const rows: DailySummary[] = await response.json();
    return rows[0] ?? null;
  } catch {
    return null;
  }
}
