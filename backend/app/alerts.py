import httpx

from app.config import Settings
from app.models import Signal


async def send_telegram_alert(signal: Signal, settings: Settings) -> None:
    if not signal.changed or not settings.telegram_bot_token or not settings.telegram_chat_id:
        return

    message = (
        f"{signal.symbol} {signal.timeframe}: {signal.action}\n"
        f"Trend: {signal.trend} | Confidence: {round(signal.confidence * 100)}%\n"
        f"Close: {signal.close}\n"
        f"TP: {signal.tp or '-'} | SL: {signal.sl or '-'}\n"
        f"{signal.summary}\n\n"
        "Execution requires manual confirmation."
    )
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(url, json={"chat_id": settings.telegram_chat_id, "text": message})
