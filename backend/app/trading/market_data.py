from datetime import datetime, timedelta, timezone

import ccxt
import pandas as pd


def fetch_ohlcv(exchange_id: str, symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
    exchange_class = getattr(ccxt, exchange_id)
    exchange = exchange_class({"enableRateLimit": True})
    candles = exchange.fetch_ohlcv(symbol, timeframe=timeframe, limit=limit)
    return _to_frame(candles)


def demo_ohlcv(symbol: str, limit: int = 260) -> pd.DataFrame:
    base = 100.0 + (sum(ord(char) for char in symbol) % 80)
    rows = []
    now = datetime.now(timezone.utc)
    for index in range(limit):
        drift = index * 0.22
        wave = ((index % 21) - 10) * 0.45
        close = base + drift + wave
        high = close * 1.015
        low = close * 0.985
        open_price = close * (0.995 if index % 2 else 1.005)
        volume = 100000 + (index % 30) * 3500
        rows.append([(now - timedelta(days=limit - index)).timestamp() * 1000, open_price, high, low, close, volume])
    return _to_frame(rows)


def _to_frame(candles: list[list[float]]) -> pd.DataFrame:
    df = pd.DataFrame(candles, columns=["timestamp", "open", "high", "low", "close", "volume"])
    df["timestamp"] = pd.to_datetime(df["timestamp"], unit="ms", utc=True)
    return df
