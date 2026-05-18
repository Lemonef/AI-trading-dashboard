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


async def send_daily_digest(signals: list[Signal], summary: str | None, settings: Settings) -> None:
    """Morning digest — sent once per day from the scanner."""
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        return

    active = [s for s in signals if s.action in {"long_setup", "short_setup"}]
    watches = [s for s in signals if s.action == "watch"]

    lines = ["📊 *Daily Market Digest*\n"]

    if active:
        lines.append(f"🔥 *Active Setups ({len(active)})*")
        for s in sorted(active, key=lambda x: x.confidence, reverse=True)[:5]:
            emoji = "🟢" if s.action == "long_setup" else "🔴"
            lines.append(f"{emoji} {s.symbol} · {s.action.replace('_', ' ')} · {round(s.confidence * 100)}% · TP {_fmt(s.tp)} SL {_fmt(s.sl)}")
    else:
        lines.append("No active setups today.")

    if watches:
        lines.append(f"\n👀 *Watching ({len(watches)})*")
        for s in sorted(watches, key=lambda x: x.confidence, reverse=True)[:5]:
            lines.append(f"🟡 {s.symbol} · {round(s.confidence * 100)}%")

    if summary:
        lines.append(f"\n🤖 *AI Brief*\n{summary[:400]}{'…' if len(summary) > 400 else ''}")

    lines.append("\n⚠️ Manual confirmation required before execution.")

    message = "\n".join(lines)
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(url, json={
            "chat_id": settings.telegram_chat_id,
            "text": message,
            "parse_mode": "Markdown",
        })
