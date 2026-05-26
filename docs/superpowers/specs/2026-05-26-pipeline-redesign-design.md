# Pipeline Redesign — Design Spec
Date: 2026-05-26

## Goal
Expand market coverage from 4 crypto pairs to ~50-100 assets across all major asset classes. Add market relevance scoring before AI runs. Integrate TradingView charts. Keep current AI summary system unchanged.

---

## Architecture: Modular — Two Services, Shared Adapters

Two concerns with clean boundaries inside the same FastAPI app:

```
Discovery Service (scheduled)     Analysis Service (on-demand)
─────────────────────────────     ────────────────────────────
MarketRegistry                    POST /api/analyze
  ↓                                 ↓
DataAdapter (shared)              DataAdapter (shared)
  ↓                                 ↓
RelevanceScorer (Strategy)        SignalPipeline (existing)
  ↓                                 ↓
market_scores (Supabase)          analysis_cache (Supabase)
```

Design patterns:
- **Adapter** — `DataAdapter` (existing CCXT→yfinance→demo chain), extended with asset routing
- **Strategy** — `RelevanceScorer` composed of swappable scoring strategies
- **Repository** — `MarketScoreStore` extends `SignalStore` pattern
- **Cache-aside** — `AnalysisCache`, key: `symbol+date+timeframe`

---

## 1. Data Layer

### MarketRegistry
New file: `backend/app/trading/market_registry.py`

```python
MARKET_REGISTRY = {
    "crypto":      ["BTC/USDT", "ETH/USDT", "SOL/USDT", "BNB/USDT", "XRP/USDT", ...],
    "forex":       ["EURUSD=X", "GBPUSD=X", "USDJPY=X", "AUDUSD=X", ...],
    "metals":      ["GC=F", "SI=F"],
    "indices":     ["^IXIC", "^GSPC", "^DJI", "^FTSE", ...],
    "commodities": ["CL=F", "ZC=F", "ZW=F"],
}
```

Target: ~50-100 symbols, curated spread across all classes. Single source of truth for both services.

### DataAdapter Extension
Existing CCXT→yfinance→demo chain gains routing logic:
- Symbol contains `/` → CCXT (crypto)
- All others → yfinance (forex, metals, indices, commodities)

No new adapter class needed — routing added inside existing `fetch_ohlcv_with_fallback()`.

### New Supabase Tables

**`market_scores`**
```sql
symbol text, asset_class text, score float,
volatility float, volume_ratio float, trend_strength float,
session_active bool, scanned_at timestamptz
```

**`analysis_cache`**
```sql
symbol text, timeframe text, date date,
signal jsonb, ai_summary text, created_at timestamptz
-- TTL enforced by query: WHERE date = today
```

---

## 2. Discovery Service (Scheduled)

### RelevanceScorer — Strategy Pattern
New file: `backend/app/discovery/scorer.py`

```python
class ScoringStrategy(Protocol):
    def score(self, df: pd.DataFrame) -> float: ...

class VolatilityStrategy:   # ATR / price ratio
class TrendStrategy:        # ADX + EMA alignment (reuses existing indicators)
class VolumeStrategy:       # volume vs 20-period avg
class SessionStrategy:      # market hours active (forex=London/NY, crypto=always)

class RelevanceScorer:
    def __init__(self, strategies: list[ScoringStrategy]): ...
    def score_market(self, symbol: str, df: pd.DataFrame) -> float:
        # weighted sum, normalized 0–1
```

### Discovery Orchestrator
New file: `backend/app/discovery/service.py`

`run_discovery()` flow:
1. Load all symbols from `MarketRegistry`
2. Batch-fetch OHLCV via `DataAdapter` (yfinance supports bulk download — one call for all non-crypto)
3. Score each symbol via `RelevanceScorer`
4. Upsert scores to `market_scores` table
5. **No AI runs here** — pure technical scoring only

New file: `backend/app/discovery/cli.py` — `python -m app.discovery.cli` entry point

New GitHub Actions: `.github/workflows/discovery.yml` — cron every 30 min, calls discovery CLI.

---

## 3. Analysis Service (On-Demand)

### Endpoint
New: `POST /api/analyze` in `main.py`

```
Request:  { symbol: str, timeframe: str }
Response: Signal (same schema as existing)

Flow:
1. Check analysis_cache WHERE symbol=? AND date=today (Bangkok TZ, UTC+7) AND timeframe=?
2. Cache hit  → return immediately (instant)
3. Cache miss → run_scan([symbol], timeframe)  ← existing function, unchanged
              → upsert to analysis_cache
              → return result
```

### Frontend UX
- `POST /api/analyze` called when user clicks a market
- Response < 300ms (cache hit) → render immediately
- Response slow (cache miss, ~8s) → TradingView chart loads instantly, AI section shows spinner, fills in on resolve
- No WebSocket needed — simple `await fetch()`

---

## 4. Frontend Changes

### Homepage — Right Sidebar Redesign (`page.tsx`)

Replace current single "Top Signal" card + "Active Setups" list with DNA-aware top markets panel:

**Structure:**
- DNA mode chips at top: `🔥 Rockstar` / `🎯 Sniper` / `🏔️ Watcher` (synced with `localStorage investor_dna`)
- "Top for [DNA]" section — top 3 markets filtered by strategy criteria:
  - Rockstar: `trend != sideways AND adx >= 25`, sorted by ADX desc
  - Sniper: `action IN (long_setup, short_setup) AND volume_ratio >= 1.3`, sorted by volume_ratio desc
  - Watcher: `trend = bullish AND rsi < 40`, sorted by confidence desc
- Each market row shows inline chips: `ADX xx` · `RSI xx` · `Vol x.x×` (color-coded)
- Click row → expand full indicator panel inline (EMA50/200, MACD, ATR, TP, SL, RR)
- Indicators panel shows for the selected/expanded market only
- Click DNA chip → list refilters, syncs with table

**Data source:** New Next.js API route `GET /api/markets` reads `market_scores` from Supabase (same pattern as existing `/api/signals-list`). `TopMarketsPanel` fetches on mount, filters client-side by active DNA.

**Implementation note:** Sidebar must become a client component (needs `localStorage` DNA state + fetch). Extract to `TopMarketsPanel.tsx`.

### Homepage — Tab Layout (unchanged)
Asset class tabs (All/Crypto/Forex/Metals/Indices/Commodities) in `SignalsTable.tsx` stay exactly as-is.

### Market Detail Page — TradingView Chart Added (`signals/[slug]/page.tsx`)

**Only addition:** TradingView chart widget inserted above the existing header card.

```tsx
// New block at top of detail page — before header card
<TradingViewWidget symbol={tradingViewSymbol(signal.symbol)} />
```

Symbol mapping function `tradingViewSymbol()`:
- `BTC/USDT` → `BINANCE:BTCUSDT`
- `GC=F` → `COMEX:GC1!`
- `EURUSD=X` → `FX:EURUSD`
- `^IXIC` → `NASDAQ:NDX`

Widget features: collapsible, timeframe switcher (1D/4H/1H).

**All existing sections unchanged:**
- Header card (symbol, exchange/timeframe, action badge, trend, Price/TP/SL/RR, confidence bar)
- Layer Analysis table (Macro/Regime/Setup/Catalyst — full verbose signal text, `deriveAnalysis()` unchanged)
- Setup Quality (Structure/Pattern/Trigger/Confirm progress bars + score)
- `StrategyView` component (All/Sniper/Rockstar/Watcher tabs, full verdict + note + Action by Position — zero changes)
- Decision box
- Entry trigger + Invalidation
- Blind-spot reminder
- All Indicators snapshot

---

## 5. What Is NOT Changed

- AI summary system (Gemini Flash for signals, Groq/Claude for daily report)
- `run_scan()` pipeline — called as-is by Analysis Service
- `StrategyView` component — zero changes
- `deriveAnalysis()` function — zero changes
- Telegram alert system
- Session identity / watchlist system
- GitHub Actions scanner workflow (existing cron unchanged, runs in parallel with new discovery cron)

---

## 6. Error Handling

- Discovery: yfinance batch fail for a symbol → log + skip, don't abort full batch
- Analysis: cache miss + AI timeout (>30s) → return signal without AI summary, `ai_enhanced: false`
- TradingView widget: unmapped symbol → hide chart section gracefully, show "Chart unavailable"
- DataAdapter: unknown symbol type → fall through to demo OHLCV

---

## 7. File Map — New Files

```
backend/app/trading/market_registry.py   # symbol catalog
backend/app/discovery/
  __init__.py
  scorer.py                              # RelevanceScorer + strategies
  service.py                             # run_discovery() orchestrator
  cli.py                                 # python -m app.discovery.cli
.github/workflows/discovery.yml          # cron every 30min

frontend/app/components/
  TopMarketsPanel.tsx                    # new client component for sidebar
  TradingViewWidget.tsx                  # TradingView chart embed
frontend/lib/
  tradingview.ts                         # symbolToTradingView() mapping
frontend/app/api/markets/route.ts        # GET /api/markets — reads market_scores from Supabase
```

## 8. Modified Files

```
backend/app/trading/market_data.py      # add routing in fetch_ohlcv_with_fallback()
backend/app/main.py                     # add POST /api/analyze endpoint
backend/supabase_schema.sql             # add market_scores + analysis_cache tables
frontend/app/page.tsx                   # replace sidebar with TopMarketsPanel
frontend/app/signals/[slug]/page.tsx    # add TradingViewWidget above header card
```
