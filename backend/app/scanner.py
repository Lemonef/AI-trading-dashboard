from app.ai import summarize_signal
from app.alerts import send_daily_digest, send_telegram_alert
from app.config import Settings
from app.models import ScanResult, Signal
from app.storage import SignalStore
from app.trading.indicators import enrich_indicators
from app.trading.market_data import (
    demo_ohlcv,
    fetch_ohlcv_with_fallback,
    fetch_ohlcv_yfinance_batch,
    is_crypto_symbol,
)
from app.trading.rules import build_signal


async def run_scan(settings: Settings) -> ScanResult:
    store = SignalStore(settings)
    signals: list[Signal] = []

    # Fetch watchlist — alerts only fire for these symbols
    watchlist = store.list_watchlist()
    print(f"Watchlist: {len(watchlist)} symbols")

    # Batch download all non-crypto symbols in one API call
    non_crypto = [s for s in settings.symbols if not is_crypto_symbol(s)]
    yf_batch: dict = {}
    if non_crypto:
        print(f"Batch downloading {len(non_crypto)} yfinance symbols…")
        try:
            yf_batch = fetch_ohlcv_yfinance_batch(non_crypto, settings.timeframe, settings.ohlcv_limit)
            print(f"  Got data for {len(yf_batch)}/{len(non_crypto)} symbols")
        except Exception as e:
            print(f"  Batch download failed ({e}) — will fetch individually")

    for symbol in settings.symbols:
        previous_action = store.latest_action(symbol, settings.timeframe)
        previous_trend = store.latest_trend(symbol, settings.timeframe)
        try:
            if is_crypto_symbol(symbol):
                candles, exchange_id, market_symbol = fetch_ohlcv_with_fallback(
                    settings.exchanges,
                    symbol,
                    settings.timeframe,
                    settings.ohlcv_limit,
                )
            elif symbol in yf_batch:
                candles = yf_batch[symbol]
                exchange_id = "yfinance"
                market_symbol = symbol
            else:
                from app.trading.market_data import fetch_ohlcv_yfinance
                candles = fetch_ohlcv_yfinance(symbol, settings.timeframe, settings.ohlcv_limit)
                exchange_id = "yfinance"
                market_symbol = symbol
        except Exception as e:
            if settings.allow_demo_data:
                candles = demo_ohlcv(symbol, settings.ohlcv_limit)
                exchange_id = "demo"
                market_symbol = symbol
            else:
                print(f"  Skipping {symbol} — {e}")
                continue

        enriched = enrich_indicators(candles)
        if len(enriched) < 2:
            print(f"  Skipping {market_symbol} — insufficient data ({len(enriched)} rows)")
            continue

        signal = build_signal(market_symbol, exchange_id, settings.timeframe, enriched, previous_action, previous_trend)
        signal.summary = await summarize_signal(signal, settings)
        store.save_signal(signal)
        # Alert only if symbol is in watchlist AND (action or trend changed)
        if symbol in watchlist and (signal.changed or signal.trend_changed):
            await send_telegram_alert(signal, settings)
        signals.append(signal)

    return ScanResult(
        scanned=len(signals),
        changed=sum(1 for signal in signals if signal.changed or signal.trend_changed),
        signals=signals,
    )
