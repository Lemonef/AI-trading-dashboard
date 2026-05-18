import httpx

from app.config import Settings
from app.models import Signal


def _fmt(value: float | None) -> str:
    if value is None:
        return "-"
    # Use up to 6 sig figs, strip trailing zeros
    return f"{value:,.6g}"


async def send_telegram_alert(signal: Signal, settings: Settings) -> None:
    if not signal.changed or not settings.telegram_bot_token or not settings.telegram_chat_id:
        return

    action_emoji = {
        "long_setup": "🟢",
        "short_setup": "🔴",
        "watch": "🟡",
        "no_trade": "⚫",
    }.get(signal.action, "")

    message = (
        f"{action_emoji} {signal.symbol} · {signal.timeframe}: {signal.action.replace('_', ' ').upper()}\n"
        f"Trend: {signal.trend} · Confidence: {round(signal.confidence * 100)}%\n"
        f"Price: {_fmt(signal.close)}\n"
        f"TP: {_fmt(signal.tp)} · SL: {_fmt(signal.sl)}\n"
        f"\n{signal.summary}\n\n"
        "⚠️ Manual confirmation required before execution."
    )
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(url, json={"chat_id": settings.telegram_chat_id, "text": message})


async def handle_bot_commands(settings: Settings) -> None:
    """Poll for /myid command and reply with the user's chat ID."""
    if not settings.telegram_bot_token:
        return
    try:
        url_base = f"https://api.telegram.org/bot{settings.telegram_bot_token}"
        # Get recent updates
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.get(f"{url_base}/getUpdates", params={"timeout": 1, "limit": 10})
            if not res.is_success:
                return
            updates = res.json().get("result", [])
            for update in updates:
                msg = update.get("message", {})
                text = msg.get("text", "")
                chat_id = msg.get("chat", {}).get("id")
                if chat_id and text.strip().startswith("/myid"):
                    await client.post(f"{url_base}/sendMessage", json={
                        "chat_id": chat_id,
                        "text": (
                            f"🤖 Your Telegram Chat ID is:\n\n"
                            f"`{chat_id}`\n\n"
                            f"Copy this number and paste it into the Trading Signal Desk → Setup Alerts."
                        ),
                        "parse_mode": "Markdown",
                    })
    except Exception:
        pass


async def send_price_alert_hit(alert: dict, price: float, level: str, settings: Settings) -> None:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    bkk_hour = (now.hour + 7) % 24
    bkk_time = now.strftime(f"%d %b %Y {bkk_hour:02d}:{now.strftime('%M')} BKK")
    note = f"\n📝 {alert['note']}" if alert.get("note") else ""
    message = (
        f"🎯 PRICE ALERT HIT\n"
        f"🕐 {bkk_time}\n"
        f"Symbol: {alert['symbol']}\n"
        f"Level: {level}\n"
        f"Current price: {_fmt(price)}{note}\n\n"
        "⚠️ Manual confirmation required before execution."
    )
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(url, json={"chat_id": settings.telegram_chat_id, "text": message})


async def send_alert_batch(signals: list[Signal], settings: Settings) -> None:
    """Send date header once, then one message per signal."""
    if not signals or not settings.telegram_bot_token or not settings.telegram_chat_id:
        return

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    # Convert to Bangkok time (UTC+7)
    bkk_hour = (now.hour + 7) % 24
    bkk_time = now.strftime(f"%d %b %Y {bkk_hour:02d}:{now.strftime('%M')} BKK")

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        # Date header
        await client.post(url, json={"chat_id": settings.telegram_chat_id, "text": f"📅 {bkk_time} · {len(signals)} signal change{'s' if len(signals) != 1 else ''}"})
        # Individual signals
        for signal in signals:
            action_emoji = {"long_setup": "🟢", "short_setup": "🔴", "watch": "🟡", "no_trade": "⚫"}.get(signal.action, "")
            flag = "📈 TREND FLIP · " if signal.trend_changed and not signal.changed else ""
            message = (
                f"{flag}{action_emoji} {signal.symbol} · {signal.timeframe}: {signal.action.replace('_', ' ').upper()}\n"
                f"Trend: {signal.trend} · Confidence: {round(signal.confidence * 100)}%\n"
                f"Price: {_fmt(signal.close)}\n"
                f"TP: {_fmt(signal.tp)} · SL: {_fmt(signal.sl)}\n"
                f"\n{signal.summary}\n\n"
                "⚠️ Manual confirmation required."
            )
            await client.post(url, json={"chat_id": settings.telegram_chat_id, "text": message})
        # End-of-batch separator
        await client.post(url, json={"chat_id": settings.telegram_chat_id, "text": "━━━━━━━━━━━━━━━━━━━━━━"})


async def send_daily_digest(signals: list[Signal], summary: str | None, settings: Settings, watchlist: set[str] | None = None) -> None:
    """Morning digest — 07:00 Bangkok. Watchlist first, then top overall."""
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return

    from datetime import date as _date
    lines = [f"🌅 *Good morning — Daily Signal Digest*", f"_{_date.today().strftime('%d %b %Y')} · Thailand time_\n"]

    # Watchlist signals first
    if watchlist:
        wl_active = sorted(
            [s for s in signals if s.symbol in watchlist and s.action in {"long_setup", "short_setup"}],
            key=lambda x: x.confidence, reverse=True
        )
        wl_watch = sorted(
            [s for s in signals if s.symbol in watchlist and s.action == "watch"],
            key=lambda x: x.confidence, reverse=True
        )
        if wl_active or wl_watch:
            lines.append("👀 *Your Watchlist*")
            for s in (wl_active + wl_watch)[:4]:
                emoji = "🟢" if s.action == "long_setup" else "🔴" if s.action == "short_setup" else "🟡"
                tp_sl = f"TP {_fmt(s.tp)} · SL {_fmt(s.sl)}" if s.tp else "No levels"
                lines.append(f"{emoji} *{s.symbol}* · {s.action.replace('_', ' ')} · {round(s.confidence * 100)}%\n   {tp_sl}")
        else:
            lines.append("👀 *Your Watchlist*\nNo active signals on watchlist today.")

    # Top 2-3 overall active setups (outside watchlist)
    all_active = sorted(
        [s for s in signals if s.action in {"long_setup", "short_setup"} and (not watchlist or s.symbol not in watchlist)],
        key=lambda x: x.confidence, reverse=True
    )[:3]
    if all_active:
        lines.append("\n🔥 *Top Market Setups*")
        for s in all_active:
            emoji = "🟢" if s.action == "long_setup" else "🔴"
            lines.append(f"{emoji} *{s.symbol}* · {round(s.confidence * 100)}% · TP {_fmt(s.tp)} · SL {_fmt(s.sl)}")

    if summary:
        lines.append(f"\n🤖 *AI Brief*\n{summary[:400]}{'…' if len(summary) > 400 else ''}")

    lines.append("\n⚠️ _Manual confirmation required before execution._")

    message = "\n".join(lines)
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(url, json={
            "chat_id": settings.telegram_chat_id,
            "text": message,
            "parse_mode": "Markdown",
        })
