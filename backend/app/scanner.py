from app.ai import summarize_signal
from app.alerts import send_telegram_alert
from app.config import Settings
from app.models import ScanResult, Signal
from app.storage import SignalStore
from app.trading.indicators import enrich_indicators
from app.trading.market_data import demo_ohlcv, fetch_ohlcv
from app.trading.rules import build_signal


async def run_scan(settings: Settings) -> ScanResult:
    store = SignalStore(settings)
    signals: list[Signal] = []

    for symbol in settings.symbols:
        previous_action = store.latest_action(symbol, settings.timeframe)
        try:
            candles = fetch_ohlcv(settings.exchange_id, symbol, settings.timeframe, settings.ohlcv_limit)
        except Exception:
            if not settings.allow_demo_data:
                raise
            candles = demo_ohlcv(symbol, settings.ohlcv_limit)

        enriched = enrich_indicators(candles)
        signal = build_signal(symbol, settings.exchange_id, settings.timeframe, enriched, previous_action)
        signal.summary = await summarize_signal(signal, settings)
        store.save_signal(signal)
        await send_telegram_alert(signal, settings)
        signals.append(signal)

    return ScanResult(
        scanned=len(signals),
        changed=sum(1 for signal in signals if signal.changed),
        signals=signals,
    )
