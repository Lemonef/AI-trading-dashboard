"""LunarCrush API v4 connector — social sentiment for crypto."""
import time
import httpx

_BASE = "https://lunarcrush.com/api4/public"
_TIMEOUT = 10
_TTL = 3600  # 1 hour cache

_cache: dict[str, tuple[dict, float]] = {}  # symbol -> (data, expires_at)

_daily_calls: list[str] = []  # dates of each actual API call (e.g. "2026-05-26")
_rate_limited: bool = False    # set True when 429 received


def daily_call_count() -> int:
    from datetime import date
    today = date.today().isoformat()
    return sum(1 for d in _daily_calls if d == today)


def is_rate_limited() -> bool:
    return _rate_limited


def _crypto_slug(symbol: str) -> str | None:
    """BTC/USDT → BTC. Non-crypto returns None."""
    if "/" not in symbol:
        return None
    return symbol.split("/")[0].upper()


async def fetch_coin_sentiment(symbol: str, api_key: str) -> dict:
    """
    Returns dict with: galaxy_score, alt_rank, sentiment, social_volume.
    Empty dict on error or non-crypto symbol.
    """
    slug = _crypto_slug(symbol)
    if not slug or not api_key:
        return {}

    now = time.time()
    if symbol in _cache and _cache[symbol][1] > now:
        return _cache[symbol][0]

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            res = await client.get(
                f"{_BASE}/coins/{slug}/v1",
                headers={"Authorization": f"Bearer {api_key}"},
            )
            if res.status_code == 429:
                global _rate_limited
                _rate_limited = True
                print(f"  [LunarCrush 429] daily limit hit — {daily_call_count()} calls today")
                return {}
            if not res.is_success:
                return {}
            from datetime import date
            _daily_calls.append(date.today().isoformat())
            data = res.json().get("data", {})
            result = {
                "galaxy_score": data.get("galaxy_score"),
                "alt_rank": data.get("alt_rank"),
                "sentiment": data.get("sentiment"),
                "social_volume": data.get("social_volume_24h"),
            }
            _cache[symbol] = (result, now + _TTL)
            return result
    except Exception:
        return {}


async def fetch_batch_sentiment(symbols: list[str], api_key: str) -> dict[str, dict]:
    """Fetch sentiment for multiple crypto symbols. Returns {symbol: sentiment_dict}."""
    if not api_key:
        return {}
    import asyncio
    tasks = {s: fetch_coin_sentiment(s, api_key) for s in symbols if "/" in s}
    results = await asyncio.gather(*tasks.values(), return_exceptions=True)
    return {
        symbol: (result if isinstance(result, dict) else {})
        for symbol, result in zip(tasks.keys(), results)
    }
