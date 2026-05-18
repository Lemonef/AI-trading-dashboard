import argparse
import asyncio
from datetime import date

import os

from app.ai import daily_strategy_summary, force_summarize_signal
from app.alerts import send_daily_digest
from app.config import get_settings
from app.scanner import run_scan
from app.storage import SignalStore


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--summarize", action="store_true", help="Force re-summarize latest signals with Gemini IDS-style prompt")
    args = parser.parse_args()

    settings = get_settings()
    store = SignalStore(settings)

    if args.summarize:
        print("Force-summarizing latest signals with Gemini...")
        signals = store.list_signals(limit=100)
        # Deduplicate — one per symbol
        seen: set[str] = set()
        unique = []
        for s in signals:
            key = f"{s.symbol}:{s.timeframe}"
            if key not in seen:
                seen.add(key)
                unique.append(s)
        print(f"Found {len(unique)} unique signals")
        print(f"supabase_enabled={store.supabase_enabled}")
        print(f"gemini_api_key={'SET' if settings.gemini_api_key else 'NOT SET — this is the problem'}")
        for signal in unique:
            print(f"  {signal.symbol} id={signal.id}")
            new_summary, ai_enhanced = await force_summarize_signal(signal, settings)
            if signal.id:
                store.update_signal_summary(signal.id, new_summary, ai_enhanced)
            else:
                print(f"    ⚠ no id — skipping update")
            label = "✦ Gemini" if ai_enhanced else "⚠ fallback (check GEMINI_API_KEY)"
            print(f"    → {label}")
        # Stamp updated_at so dashboard shows correct "Last AI summary" time
        store.save_daily_summary(date.today().isoformat(), "", len(unique))
        print("Done.")
        return

    # Normal scan
    result = await run_scan(settings)
    print(f"scanned={result.scanned} changed={result.changed}")
    for signal in result.signals:
        print(f"  {signal.symbol} {signal.action} {signal.trend} conf={signal.confidence}")

    summary = await daily_strategy_summary(result.signals, settings)
    if summary:
        store.save_daily_summary(date.today().isoformat(), summary, result.scanned)
        print(f"daily_summary saved ({len(summary)} chars)")
    else:
        print("daily_summary skipped (GEMINI_API_KEY not set or error)")

    # Morning run at 00:00 UTC = 07:00 Bangkok
    from datetime import datetime, timezone
    utc_hour = datetime.now(timezone.utc).hour
    force_digest = os.environ.get("FORCE_DIGEST", "") == "1"
    if utc_hour == 0 or force_digest:
        # Step 1: Force-regenerate all signal summaries with AI
        print("Morning run — force-summarizing all signals with AI…")
        stored = store.list_signals(limit=100)
        seen: set[str] = set()
        unique = []
        for s in stored:
            key = f"{s.symbol}:{s.timeframe}"
            if key not in seen:
                seen.add(key)
                unique.append(s)
        for signal in unique:
            new_summary, ai_enhanced = await force_summarize_signal(signal, settings)
            if signal.id:
                store.update_signal_summary(signal.id, new_summary, ai_enhanced)
            print(f"  {signal.symbol}: {'✦ AI' if ai_enhanced else '— template'}")

        # Step 2: Regenerate daily strategy summary with fresh AI
        summary = await daily_strategy_summary(result.signals, settings)
        if summary:
            store.save_daily_summary(date.today().isoformat(), summary, result.scanned)
            print(f"daily_summary refreshed ({len(summary)} chars)")

        # Step 3: Send morning digest to Telegram
        print("Sending morning digest to Telegram…")
        watchlist = store.list_watchlist()
        await send_daily_digest(result.signals, summary, settings, watchlist)
        print("Digest sent.")


if __name__ == "__main__":
    asyncio.run(main())
