# Watcher

Role: long-term system and regime monitor.

Watcher is the slow layer. It catches mixed regimes, stale assumptions, and future drift between backtest and live behavior.

## Current MVP

- Mark sideways or unclear regimes as `no_trade`.
- Track signal changes so AI summaries and Telegram alerts only fire when useful.
- Preserve a history of scanner decisions in Supabase or local JSON.

## Later

- Weekly performance review.
- Live-vs-backtest drift detection.
- Portfolio and exposure awareness.
- Confirm-button workflow for backend-mediated order placement.
