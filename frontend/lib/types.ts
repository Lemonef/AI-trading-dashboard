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
  trend_changed?: boolean;
  ai_enhanced?: boolean;
  created_at: string;
  indicators: Record<string, number | null>;
  reasons: string[];
};

export type PriceAlert = {
  id: string;
  symbol: string;
  entry: number | null;
  tp: number | null;
  sl: number | null;
  note: string | null;
  active: boolean;
  triggered_at: string | null;
  created_at: string;
  session_id?: string;
};

export type DailySummary = {
  date: string;
  summary: string;
  signals_count: number;
  created_at: string;
  updated_at?: string;
};
