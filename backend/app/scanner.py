from app.ai import summarize_signal
from app.alerts import _fmt, handle_bot_commands, send_alert_batch, send_daily_digest, send_price_alert_hit
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
        signals.append(signal)

    # Handle /myid bot command
    await handle_bot_commands(settings)

    # Send per-user watchlist alerts
    user_groups = store.list_watchlist_by_user()
    for group in user_groups:
        user_chat_id = group.get("telegram_chat_id") or settings.telegram_chat_id
        if not user_chat_id:
            continue
        user_symbols = set(group["symbols"])
        user_alerts = [s for s in signals if s.symbol in user_symbols and (s.changed or s.trend_changed)]
        if user_alerts:
            user_settings = settings.model_copy(update={"telegram_chat_id": user_chat_id})
            await send_alert_batch(user_alerts, user_settings)

    # Check custom price alerts
    price_map = {s.symbol: s.close for s in signals}
    price_alerts = store.list_price_alerts(active_only=True)
    for alert in price_alerts:
        price = price_map.get(alert["symbol"])
        if price is None:
            continue
        tp = alert.get("tp")
        sl = alert.get("sl")
        entry = alert.get("entry")
        triggered = None
        if tp and price >= tp:
            triggered = f"🎯 TP {_fmt(tp)} hit — price {_fmt(price)} ≥ target"
        elif sl and price <= sl:
            triggered = f"🛑 SL {_fmt(sl)} hit — price {_fmt(price)} ≤ stop"
        elif entry and price <= entry:
            triggered = f"📍 Entry {_fmt(entry)} reached — price {_fmt(price)} ≤ entry zone"
        if triggered:
            await send_price_alert_hit(alert, price, triggered, settings)
            store.trigger_price_alert(alert["id"])

    return ScanResult(
        scanned=len(signals),
        changed=sum(1 for signal in signals if signal.changed or signal.trend_changed),
        signals=signals,
    )
