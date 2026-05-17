Build an AI-assisted trading dashboard.

Stack:
- Next.js + Tailwind frontend
- FastAPI Python backend
- Supabase Postgres database
- GitHub Actions scheduled scanner
- Telegram alerts
- Gemini Flash for frequent summaries
- Claude for daily strategic summary
- CCXT for Bybit/Binance execution later
- skills/ folder with sniper.md, rockstar.md, architect.md, watcher.md

System behavior:
1. Fetch watchlist market data.
2. Calculate EMA50, EMA200, MACD, ADX, RSI, ATR, volume.
3. Detect trend flips and breakout setups using Python rules.
4. Use Gemini Flash only when signal changes.
5. Use Claude once per day for higher-quality market summary.
6. Save signals to Supabase.
7. Send Telegram alert.
8. Dashboard displays watchlist, trend status, AI summary, TP/SL.
9. Later: add confirm button that places order through backend, not full auto trading.

Trading logic:
- Rockstar = trend filter
- Sniper = entry trigger
- Architect = TP/SL and risk management
- Watcher = long-term system later

Do not build full autonomous trading yet.
Start with dashboard + scanner + alerts.