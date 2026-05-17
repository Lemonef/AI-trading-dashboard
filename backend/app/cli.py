import asyncio

from app.config import get_settings
from app.scanner import run_scan


async def main() -> None:
    result = await run_scan(get_settings())
    print(f"scanned={result.scanned} changed={result.changed}")
    for signal in result.signals:
        print(f"{signal.symbol} {signal.action} {signal.trend} confidence={signal.confidence}")


if __name__ == "__main__":
    asyncio.run(main())
