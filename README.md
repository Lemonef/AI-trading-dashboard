# AI Trading Dashboard

MVP for an AI-assisted trading scanner and dashboard. It scans a watchlist, calculates technical indicators, detects trend and breakout changes, stores signals, and can send Telegram alerts. It does not place trades.

## Stack

- `frontend/`: Next.js + Tailwind dashboard
- `backend/`: FastAPI scanner API
- Supabase Postgres for production signal storage
- GitHub Actions scheduled scanner
- Telegram alerts
- Gemini Flash summaries on signal changes
- Claude daily strategic summaries

## Local Setup

```powershell
cd backend
python -m venv .venv
.\\.venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Copy `.env.example` to `.env` in the repo root or set these variables in your shell:

```env
WATCHLIST=BTC/USDT,ETH/USDT,SOL/USDT,BNB/USDT
EXCHANGE_ID=binance
FALLBACK_EXCHANGE_IDS=coinbase,kraken
TIMEFRAME=1d
OHLCV_LIMIT=260
ALLOW_DEMO_DATA=true

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

GEMINI_API_KEY=
ANTHROPIC_API_KEY=
CLAUDE_DAILY_MODEL=claude-3-5-sonnet-latest

NEXT_PUBLIC_API_URL=http://localhost:8000
```

If Supabase credentials are absent, the backend writes to `backend/data/signals.json`.
For GitHub Actions, keep `ALLOW_DEMO_DATA=false` so scheduled runs fail instead of saving fallback demo candles.
For Vercel, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` so the dashboard can read signals directly from Supabase.

## Safety Boundary

This app is a decision-support tool. It scans, summarizes, stores, and alerts. It does not execute trades. Future execution should stay behind a backend confirmation endpoint and require explicit user action.
