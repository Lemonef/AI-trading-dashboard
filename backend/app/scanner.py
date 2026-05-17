from app.ai import summarize_signal
from app.alerts import send_telegram_alert
from app.config import Settings
from app.models import ScanResult, Signal
from app.storage import SignalStore
from app.trading.indicators import enrich_indicators
from app.trading.market_data import demo_ohlcv, fetch_ohlcv_with_fallback, fetch_ohlcv_yfinance, is_crypto_symbol
from app.trading.rules import build_signal


async def run_scan(settings: Settings) -> ScanResult:
    store = SignalStore(settings)
    signals: list[Signal] = []

    for symbol in settings.symbols:
        previous_action = store.latest_action(symbol, settings.timeframe)
        try:
            if is_crypto_symbol(symbol):
                candles, exchange_id, market_symbol = fetch_ohlcv_with_fallback(
                    settings.exchanges,
                    symbol,
                    settings.timeframe,
                    settings.ohlcv_limit,
                )
            else:
                candles = fetch_ohlcv_yfinance(symbol, settings.timeframe, settings.ohlcv_limit)
                exchange_id = "yfinance"
                market_symbol = symbol
        except Exception:
            if not settings.allow_demo_data:
                raise
            candles = demo_ohlcv(symbol, settings.ohlcv_limit)
            exchange_id = "demo"
            market_symbol = symbol

        enriched = enrich_indicators(candles)
        signal = build_signal(market_symbol, exchange_id, settings.timeframe, enriched, previous_action)
        signal.summary = await summarize_signal(signal, settings)
        store.save_signal(signal)
        await send_telegram_alert(signal, settings)
        signals.append(signal)

    return ScanResult(
        scanned=len(signals),
        changed=sum(1 for signal in signals if signal.changed),
        signals=signals,
    )
