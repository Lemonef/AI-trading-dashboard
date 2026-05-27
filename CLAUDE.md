# Trading Signal Desk

## Context
Before any task, read `graphify-out/GRAPH_REPORT.md` for architecture context.
For tasks touching trading logic, signals, entries, or risk — read relevant files in `skills/`: `sniper.md`, `rockstar.md`, `architect.md`, `watcher.md`, `Legends-SKILL.md`, `Investor-DNA-SKILL.md`, `Investor-Decision-Stack-SKILL.md`.

AI-assisted trading dashboard. Scanner runs rules-based analysis, stores signals to Supabase, sends Telegram alerts. Dashboard reads signals and displays them. **No auto-execution.** User must confirm any trade.

## Automation Schedule (GitHub Actions)

| Time (BKK) | Workflow | What runs |
|---|---|---|
| Every 30 min | `scanner.yml` | Fetch market data (yfinance/CCXT), build signals, save to Supabase, Telegram alert on change |
| Every 30 min (after scanner) | `discovery.yml` | Market Discovery on fresh signal data (`workflow_run` trigger) |
| 07:00 daily | `scanner.yml` (0 0 UTC) | Same scan + LunarCrush sentiment fetch + Telegram morning digest (`FORCE_DIGEST=1`) |
| 10:00 daily | `summarize.yml` (0 3 UTC) | AI per-signal summaries (Groq/Gemini) with cached LunarCrush sentiment + macro |

**Notes:**
- `FORCE_DIGEST=1` set via `github.event.schedule` expression — digest fires reliably even when GH Actions delays job start past 01:00 UTC
- LunarCrush data fetched once/day (morning scan), cached in Supabase `sentiment_cache` table (25h TTL)
- Summarize reads that cache at 10:00 BKK → AI gets galaxy score, alt rank, sentiment%, fear/greed, BTC dominance
- `enrichment` field is NOT stored in Supabase signals table (intentional) — rehydrated from cache at summarize time
- Groq free tier: 6,000 TPM on llama-3.1-8b-instant → `_RATE_LIMIT_SLEEP = 26s` per signal → 72 signals ≈ 31 min
- Circuit breakers: `_groq_exhausted` + `_gemini_exhausted` in `ai.py` — skip remaining calls when daily quota hit
- Scan completion Telegram message removed — only fires on signal change/trend change or price alert hit

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 + Tailwind 3, deployed statically |
| Backend | FastAPI (Python 3.12), `uvicorn` |
| Database | Supabase Postgres (`signals` table) |
| Market data | CCXT → Binance/Coinbase/Kraken + yfinance (non-crypto), demo fallback |
| AI (signal) | Groq llama-3.1-8b-instant (primary) → Gemini 2.0 Flash (fallback) |
| AI (daily) | Groq llama-3.1-8b-instant — §11 IDS Daily Report |
| Sentiment | LunarCrush (crypto) + CoinGecko fear/greed macro |
| Alerts | Telegram bot |
| Scheduler | GitHub Actions cron |

## Project Layout

```
backend/
  app/
    config.py          # Settings via pydantic-settings, reads .env
    models.py          # Signal, ScanResult pydantic models
    scanner.py         # run_scan() — orchestrates full pipeline
    storage.py         # SignalStore: read/write Supabase or local JSON
    ai.py              # summarize_signal() + daily_strategy_summary()
    alerts.py          # send_telegram_alert()
    trading/
      indicators.py    # EMA50/200, RSI, MACD, ATR, ADX, volume
      rules.py         # build_signal() — trend + action + TP/SL + confidence
      market_data.py   # fetch_ohlcv_with_fallback(), demo_ohlcv()
    main.py            # FastAPI: GET /api/signals, POST /api/scan, GET /health
frontend/
  app/
    page.tsx           # Server component — reads signals, renders dashboard
    layout.tsx         # Root layout with font
    globals.css        # Base styles
    components/
      ScanButton.tsx   # Client component — triggers POST /api/scan
  lib/
    api.ts             # getSignals() — Supabase first, backend fallback, demo last
skills/
  sniper.md            # Entry trigger rules (breakout + volume + MACD + RSI)
  rockstar.md          # Trend filter (EMA50 vs EMA200 + ADX)
  architect.md         # TP/SL and risk management (ATR-based)
  watcher.md           # Long-term regime filter (future)
  Legends-SKILL.md
  Investor-DNA-SKILL.md
  Investor-Decision-Stack-SKILL.md
```

## Data Flow

```
scanner.yml (every 30 min)
  → python -m app.cli
    → fetch OHLCV: CCXT crypto / yfinance batch non-crypto
    → enrich_indicators() — EMA50/200, RSI, MACD, ATR, ADX, volume
    → build_signal() — trend + action + TP/SL + confidence + reasons
    → apply_sentiment_boost() — if LunarCrush cache available
    → summarize_signal() — template only (no AI on regular scans)
    → SignalStore.save_signal() — Supabase
    → send_alert_batch() — only if signal.changed or trend_changed
  [morning run only, 0 0 UTC]
    → fetch fresh LunarCrush sentiment → SentimentStore.set_batch()
    → fetch CoinGecko macro (fear/greed, BTC dominance)
    → daily_strategy_summary() — Groq §11 IDS report
    → send_daily_digest() — Telegram morning briefing

discovery.yml (after each scanner run, workflow_run trigger)
  → python -m app.discovery.cli
    → Market Discovery on fresh signal data

summarize.yml (daily 0 3 UTC = 10:00 BKK)
  → python -m app.cli --summarize
    → load signals from Supabase
    → rehydrate enrichment from sentiment_cache (galaxy, alt_rank, sentiment%)
    → rehydrate macro from CoinGecko (fear/greed, BTC dominance)
    → force_summarize_signal() each — Groq (26s sleep) → Gemini fallback
    → update Supabase with AI summary text

Frontend (Next.js SSR)
  → getSignals() in lib/api.ts
    → Supabase REST API first
    → fallback: GET /api/signals from backend
    → fallback: hardcoded demo signal
  → renders page.tsx with all signals
```

## Trading Logic (skills/)

- **Rockstar** — trend filter: EMA50 > EMA200 + ADX ≥ 20 → bullish; opposite → bearish
- **Sniper** — entry trigger: 20-period breakout + volume ratio ≥ 1.3 + MACD cross + RSI in range
- **Architect** — TP = close + ATR × 2.2; SL = close − ATR × 1.1 (reversed for shorts)
- **Watcher** — regime: sideways/no-clear-trend → `no_trade`
- Confidence score: 0.25 base + ADX bonus + volume bonus + RSI bonus + action bonus (max 0.95)

## Signal Actions

| Action | Meaning |
|---|---|
| `long_setup` | Bullish trend + sniper trigger confirmed |
| `short_setup` | Bearish trend + sniper trigger confirmed |
| `watch` | Trend active but trigger not clean |
| `no_trade` | Sideways/mixed regime |

## Dev Commands

```bash
# Backend
cd backend
pip install -e .
uvicorn app.main:app --reload          # dev server on :8000
python -m app.cli                      # run scan manually

# Frontend
cd frontend
npm install
npm run dev                            # dev server on :3000
npm run build && npm start             # production
```

## Environment Variables

```env
# Watchlist + exchange
WATCHLIST=BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT
EXCHANGE_ID=binance
TIMEFRAME=1d

# Supabase (backend writes, frontend reads)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Backend API (frontend fallback)
NEXT_PUBLIC_API_URL=http://localhost:8000

# AI
GEMINI_API_KEY=
ANTHROPIC_API_KEY=
CLAUDE_DAILY_MODEL=claude-sonnet-4-6

# Alerts
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

## What Is NOT Built Yet

- Trade execution (CCXT order placement)
- Confirm button + backend order review endpoint
- Multi-timeframe support
- Watcher long-term regime system
- Authentication on dashboard
- Historical signal chart / equity curve
