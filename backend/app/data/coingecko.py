"""CoinGecko + Alternative.me connectors — macro crypto context."""
import httpx

_TIMEOUT = 10


async def fetch_fear_greed() -> dict:
    """
    Alternative.me Fear & Greed Index — free, no key.
    Returns: {value: 0-100, label: 'Extreme Fear'|'Fear'|'Neutral'|'Greed'|'Extreme Greed'}
    """
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            res = await client.get("https://api.alternative.me/fng/?limit=1")
            if not res.is_success:
                return {}
            entry = res.json().get("data", [{}])[0]
            return {
                "fear_greed_value": int(entry.get("value", 50)),
                "fear_greed_label": entry.get("value_classification", "Neutral"),
            }
    except Exception:
        return {}


async def fetch_global_market() -> dict:
    """
    CoinGecko global market data — free, no key needed.
    Returns: {btc_dominance, eth_dominance, total_market_cap_usd, market_cap_change_24h}
    """
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            res = await client.get(
                "https://api.coingecko.com/api/v3/global",
                headers={"Accept": "application/json"},
            )
            if not res.is_success:
                return {}
            data = res.json().get("data", {})
            pct = data.get("market_cap_percentage", {})
            return {
                "btc_dominance": round(pct.get("btc", 0), 1),
                "eth_dominance": round(pct.get("eth", 0), 1),
                "total_market_cap_usd": data.get("total_market_cap", {}).get("usd"),
                "market_cap_change_24h": round(data.get("market_cap_change_percentage_24h_usd", 0), 2),
            }
    except Exception:
        return {}


async def fetch_macro_context() -> dict:
    """Combine fear/greed + global market into one context dict."""
    import asyncio
    fg, gm = await asyncio.gather(fetch_fear_greed(), fetch_global_market())
    return {**fg, **gm}
