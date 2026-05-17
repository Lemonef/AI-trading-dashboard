import asyncio
from datetime import date

from app.ai import daily_strategy_summary
from app.config import get_settings
from app.scanner import run_scan
from app.storage import SignalStore


async def main() -> None:
    settings = get_settings()
    result = await run_scan(settings)
    print(f"scanned={result.scanned} changed={result.changed}")
    for signal in result.signals:
        print(f"  {signal.symbol} {signal.action} {signal.trend} conf={signal.confidence}")

    summary = await daily_strategy_summary(result.signals, settings)
    if summary:
        SignalStore(settings).save_daily_summary(
            date.today().isoformat(), summary, result.scanned
        )
        print(f"daily_summary saved ({len(summary)} chars)")
    else:
        print("daily_summary skipped (ANTHROPIC_API_KEY not set or error)")


if __name__ == "__main__":
    asyncio.run(main())
