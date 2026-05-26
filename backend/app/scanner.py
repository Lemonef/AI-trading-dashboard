import asyncio

from app.ai import summarize_signal
from app.alerts import _fmt, register_bot_commands, send_alert_batch, send_price_alert_hit, send_system_alert
from app.config import Settings
from app.models import ScanResult, Signal
from app.storage import SignalStore
from app.trading.indicators import enrich_indicators
from app.trading.market_data import (
    demo_ohlcv,
    fetch_ohlcv_with_fallback,
    fetch_ohlcv_yfinance,
    fetch_ohlcv_yfinance_batch,
    is_crypto_symbol,
)
from app.trading.rules import build_signal


async def run_scan(settings: Settings, manual: bool = False) -> ScanResult:
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

    # Enrich crypto signals with social sentiment — manual scan only (conserves 25/day free tier)
    if manual and settings.lunarcrush_api_key:
        from app.data.lunarcrush import fetch_batch_sentiment, is_rate_limited, daily_call_count
        from app.data.coingecko import fetch_macro_context
        crypto_symbols = [s.symbol for s in signals if "/" in s.symbol]
        if crypto_symbols:
            sentiment_map, macro = await asyncio.gather(
                fetch_batch_sentiment(crypto_symbols, settings.lunarcrush_api_key),
                fetch_macro_context(),
            )
            if is_rate_limited():
                await send_system_alert(
                    "⚠️ LunarCrush daily API limit hit\n"
                    f"Used {daily_call_count()} calls today (free tier: 25/day).\n"
                    "Sentiment enrichment skipped for remaining symbols. Resets tomorrow.",
                    settings,
                )
            for signal in signals:
                enrichment = {}
                if signal.symbol in sentiment_map:
                    enrichment.update(sentiment_map[signal.symbol])
                if macro:
                    enrichment.update(macro)
                if enrichment:
                    signal.enrichment = enrichment
                    store.save_signal(signal)  # re-save with enrichment

    # Keep command menu registered
    await register_bot_commands(settings)

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

    # Check custom price alerts — route to each user's own Telegram chat ID
    price_map = {s.symbol: s.close for s in signals}
    session_chat_map = {g["session_id"]: g["telegram_chat_id"] for g in user_groups if g.get("session_id")}
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
            # Send to the user who created the alert, not global chat
            alert_session = alert.get("session_id")
            user_chat_id = session_chat_map.get(alert_session) or settings.telegram_chat_id
            alert_settings = settings.model_copy(update={"telegram_chat_id": user_chat_id})
            await send_price_alert_hit(alert, price, triggered, alert_settings)
            store.trigger_price_alert(alert["id"])

    changed_count = sum(1 for signal in signals if signal.changed or signal.trend_changed)
    active_setups = [s for s in signals if s.action in ("long_setup", "short_setup")]
    active_setups.sort(key=lambda s: s.confidence, reverse=True)

    lines = [
        f"✅ Scan complete — {len(signals)} markets, {changed_count} changed",
        f"🎯 Active setups: {len(active_setups)}",
    ]
    for s in active_setups[:3]:
        emoji = "🟢" if s.action == "long_setup" else "🔴"
        lines.append(f"  {emoji} {s.symbol} · {round(s.confidence * 100)}% · TP {_fmt(s.tp)} SL {_fmt(s.sl)}")
    await send_system_alert("\n".join(lines), settings)

    return ScanResult(
        scanned=len(signals),
        changed=changed_count,
        signals=signals,
    )


async def analyze_symbol(symbol: str, timeframe: str, settings: Settings) -> Signal:
    """Single-symbol analysis pipeline. No save, no alerts. Used by /api/analyze."""
    from app.trading.indicators import enrich_indicators
    from app.trading.rules import build_signal

    try:
        if is_crypto_symbol(symbol):
            candles, exchange_id, market_symbol = fetch_ohlcv_with_fallback(
                settings.exchanges, symbol, timeframe, settings.ohlcv_limit
            )
        else:
            candles = fetch_ohlcv_yfinance(symbol, timeframe, settings.ohlcv_limit)
            exchange_id = "yfinance"
            market_symbol = symbol
    except Exception:
        if not settings.allow_demo_data:
            raise
        candles = demo_ohlcv(symbol, settings.ohlcv_limit)
        exchange_id = "demo"
        market_symbol = symbol

    enriched = enrich_indicators(candles)
    signal = build_signal(market_symbol, exchange_id, timeframe, enriched, None, None)
    if hasattr(signal, "summary"):
        signal.summary = await summarize_signal(signal, settings)
    return signal
