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
    parser.add_argument("--sentiment", action="store_true", help="Fetch fresh LunarCrush sentiment (daily run + manual only)")
    args = parser.parse_args()

    settings = get_settings()
    store = SignalStore(settings)

    if args.summarize:
        print("Force-summarizing latest signals with Gemini...")
        signals = store.list_signals(limit=500)
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

        # Load cached LunarCrush sentiment + macro so AI summaries are enriched
        sentiment_map: dict[str, dict] = {}
        macro: dict = {}
        if settings.lunarcrush_api_key:
            from app.data.sentiment_cache import SentimentStore
            from app.data.coingecko import fetch_macro_context
            crypto_symbols = [s.symbol for s in unique if "/" in s.symbol]
            if crypto_symbols:
                sentiment_map = SentimentStore(settings).get_batch(crypto_symbols)
                print(f"  sentiment cache: {len(sentiment_map)}/{len(crypto_symbols)} symbols")
            macro = await fetch_macro_context()

        for signal in unique:
            # Attach cached sentiment before AI call — enrichment is stripped from Supabase
            enrichment: dict = {}
            if signal.symbol in sentiment_map:
                enrichment.update(sentiment_map[signal.symbol])
            if macro:
                enrichment.update(macro)
            if enrichment:
                signal.enrichment = enrichment

            print(f"  {signal.symbol} id={signal.id}")
            new_summary, ai_enhanced = await force_summarize_signal(signal, settings)
            # Parse Score: N/10 — word from AI response to store separately
            ai_score: int | None = None
            ai_score_label: str | None = None
            if ai_enhanced:
                import re
                m = re.search(r"Score:\s*(\d+)/10\s*[—–\-]\s*(\w+)", new_summary, re.IGNORECASE)
                if m:
                    ai_score = int(m.group(1))
                    ai_score_label = m.group(2)
            if signal.id:
                store.update_signal_summary(signal.id, new_summary, ai_enhanced, ai_score, ai_score_label)
            else:
                print(f"    ⚠ no id — skipping update")
            score_str = f" score={ai_score}/10 ({ai_score_label})" if ai_score else ""
            label = f"✦ AI{score_str}" if ai_enhanced else "⚠ fallback (check GEMINI_API_KEY)"
            print(f"    → {label}")
        # Stamp updated_at so dashboard shows correct "Last AI summary" time
        store.stamp_summarize_time(date.today().isoformat())
        print("Done.")
        return

    # Normal scan — sentiment=True on daily morning run or explicit --sentiment flag
    from datetime import datetime, timezone
    utc_hour = datetime.now(timezone.utc).hour
    force_digest = os.environ.get("FORCE_DIGEST", "") == "1"
    _is_morning = force_digest or utc_hour == 0
    result = await run_scan(settings, sentiment=args.sentiment or _is_morning)
    print(f"scanned={result.scanned} changed={result.changed}")
    for signal in result.signals:
        print(f"  {signal.symbol} {signal.action} {signal.trend} conf={signal.confidence}")

    summary = await daily_strategy_summary(result.signals, settings)
    if summary:
        store.save_daily_summary(date.today().isoformat(), summary, result.scanned)
        print(f"daily_summary saved ({len(summary)} chars)")
    else:
        print("daily_summary skipped (GEMINI_API_KEY not set or error)")

    # Morning run: triggered by 0 0 * * * schedule (FORCE_DIGEST=1) or hour==0 fallback
    # Per-signal AI summaries are handled by Regenerate Summaries workflow at 03:00 UTC
    if _is_morning:
        print("Sending morning digest to Telegram…")
        watchlist = store.list_watchlist()
        await send_daily_digest(result.signals, summary, settings, watchlist)
        print("Digest sent.")


if __name__ == "__main__":
    asyncio.run(main())
