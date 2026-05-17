from datetime import datetime, timedelta, timezone

import ccxt
import pandas as pd


class MarketDataUnavailable(RuntimeError):
    pass


def is_crypto_symbol(symbol: str) -> bool:
    return "/" in symbol


def fetch_ohlcv_yfinance(symbol: str, timeframe: str, limit: int) -> pd.DataFrame:
    import yfinance as yf

    interval_map = {"1d": "1d", "4h": "60m", "1h": "60m", "1w": "1wk", "1M": "1mo"}
    interval = interval_map.get(timeframe, "1d")
    period = "2y" if limit >= 200 else "1y"

    hist = yf.Ticker(symbol).history(period=period, interval=interval)
    if hist.empty:
        raise MarketDataUnavailable(f"yfinance returned no data for {symbol}")

    df = hist[["Open", "High", "Low", "Close", "Volume"]].copy()
    df.columns = pd.Index(["open", "high", "low", "close", "volume"])
    df = df.dropna().reset_index(drop=True)
    return df.tail(limit).reset_index(drop=True)


def fetch_ohlcv_yfinance_batch(symbols: list[str], timeframe: str, limit: int) -> dict[str, pd.DataFrame]:
    """Download all yfinance symbols in one API call — much faster than per-symbol."""
    import yfinance as yf

    if not symbols:
        return {}

    interval_map = {"1d": "1d", "4h": "60m", "1h": "60m", "1w": "1wk", "1M": "1mo"}
    interval = interval_map.get(timeframe, "1d")
    period = "2y" if limit >= 200 else "1y"

    raw = yf.download(
        symbols,
        period=period,
        interval=interval,
        group_by="ticker",
        auto_adjust=True,
        progress=False,
        threads=True,
    )

    result: dict[str, pd.DataFrame] = {}
    for symbol in symbols:
        try:
            df = raw[symbol] if len(symbols) > 1 else raw
            if df is None or df.empty:
                continue
            df = df[["Open", "High", "Low", "Close", "Volume"]].copy()
            df.columns = pd.Index(["open", "high", "low", "close", "volume"])
            df = df.dropna().reset_index(drop=True)
            if len(df) >= 50:
                result[symbol] = df.tail(limit).reset_index(drop=True)
        except Exception:
            pass

    return result


def fetch_ohlcv_with_fallback(
    exchange_ids: list[str],
    symbol: str,
    timeframe: str,
    limit: int,
) -> tuple[pd.DataFrame, str, str]:
    errors: list[str] = []
    for exchange_id in exchange_ids:
        for candidate in _symbol_candidates(symbol, exchange_id):
            try:
                return fetch_ohlcv(exchange_id, candidate, timeframe, limit), exchange_id, candidate
            except Exception as exc:
                errors.append(f"{exchange_id}:{candidate}: {exc}")
    raise MarketDataUnavailable("; ".join(errors[-4:]))


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


def _symbol_candidates(symbol: str, exchange_id: str) -> list[str]:
    candidates = [symbol]
    if symbol.endswith("/USDT") and exchange_id in {"coinbase", "kraken"}:
        candidates.append(symbol.replace("/USDT", "/USD"))
    return list(dict.fromkeys(candidates))
