# Trading Signal Desk

AI-assisted trading dashboard. Scanner runs rules-based analysis, stores signals to Supabase, sends Telegram alerts. Dashboard reads signals and displays them. **No auto-execution.** User must confirm any trade.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 + Tailwind 3, deployed statically |
| Backend | FastAPI (Python 3.12), `uvicorn` |
| Database | Supabase Postgres (`signals` table) |
| Market data | CCXT → Binance/Coinbase/Kraken, demo fallback |
| AI (signal) | Gemini 1.5 Flash — runs only on `changed` signals |
| AI (daily) | Claude (configurable model) — once/day strategy summary |
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
GitHub Actions cron
  → POST /api/scan (or python -m app.cli)
    → fetch OHLCV via CCXT (Binance → Coinbase → Kraken → demo)
    → enrich_indicators() — pandas DataFrame
    → build_signal() — trend + action + TP/SL + confidence + reasons
    → summarize_signal() — Gemini Flash (only if signal.changed)
    → SignalStore.save_signal() — Supabase (or local data/)
    → send_telegram_alert() — only if changed

Frontend (Next.js SSR)
  → getSignals() in lib/api.ts
    → Supabase REST API first
    → fallback: GET /api/signals from backend
    → fallback: single hardcoded demo signal
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
