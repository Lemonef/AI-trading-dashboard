from app.config import Settings
from app.discovery.scorer import RelevanceScorer, TrendStrategy, VolatilityStrategy, VolumeStrategy
from app.discovery.store import MarketScoreStore
from app.trading.indicators import enrich_indicators
from app.trading.market_data import (
    fetch_ohlcv_with_fallback,
    fetch_ohlcv_yfinance,
    fetch_ohlcv_yfinance_batch,
    is_crypto_symbol,
    demo_ohlcv,
    MarketDataUnavailable,
)
from app.trading.market_registry import asset_class
from app.trading.rules import build_signal


async def run_discovery(settings: Settings) -> dict:
    """Score all symbols and persist to market_scores. No AI, no alerts."""
    scorer = RelevanceScorer([VolatilityStrategy(), TrendStrategy(), VolumeStrategy()])
    store = MarketScoreStore(settings)
    symbols = settings.symbols
    rows = []

    non_crypto = [s for s in symbols if not is_crypto_symbol(s)]
    yf_batch: dict = {}
    if non_crypto:
        try:
            yf_batch = fetch_ohlcv_yfinance_batch(non_crypto, settings.timeframe, settings.ohlcv_limit)
        except Exception as exc:
            print(f"[discovery] batch download failed: {exc}")

    for symbol in symbols:
        try:
            if is_crypto_symbol(symbol):
                df_raw, _, _ = fetch_ohlcv_with_fallback(
                    settings.exchanges, symbol, settings.timeframe, settings.ohlcv_limit
                )
            elif symbol in yf_batch:
                df_raw = yf_batch[symbol]
            else:
                df_raw = fetch_ohlcv_yfinance(symbol, settings.timeframe, settings.ohlcv_limit)
        except (MarketDataUnavailable, Exception):
            if settings.allow_demo_data:
                df_raw = demo_ohlcv(symbol, settings.ohlcv_limit)
            else:
                continue

        df = enrich_indicators(df_raw)
        if len(df) < 50:
            continue

        score = scorer.score_market(symbol, df)
        last = df.iloc[-1]
        signal = build_signal(symbol, "yfinance", settings.timeframe, df, None, None)

        rows.append({
            "symbol": symbol,
            "asset_class": asset_class(symbol),
            "score": score,
            "trend": signal.trend,
            "adx": float(last.get("adx", 0) or 0),
            "rsi": float(last.get("rsi", 50) or 50),
            "volume_ratio": float(
                df["volume"].iloc[-1] / df["volume"].iloc[-21:-1].mean()
                if len(df) >= 21 and df["volume"].iloc[-21:-1].mean() > 0
                else 1.0
            ),
            "trend_strength": float(last.get("adx", 0) or 0),
            "volatility": float(
                (last.get("atr", 0) or 0) / (last.get("close", 1) or 1)
            ),
            "session_active": True,
        })

    store.save_scores(rows)
    print(f"[discovery] scored {len(rows)}/{len(symbols)} symbols")
    return {"scored": len(rows), "total": len(symbols)}
