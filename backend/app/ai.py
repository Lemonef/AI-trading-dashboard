from datetime import date

from app.config import Settings
from app.models import Signal


async def summarize_signal(signal: Signal, settings: Settings) -> str:
    if not settings.gemini_api_key or not signal.changed:
        return signal.summary

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            "Summarize this trading scanner signal in two concise sentences. "
            "Do not give financial advice. Emphasize that execution requires user confirmation.\n"
            f"{signal.model_dump_json()}"
        )
        response = await model.generate_content_async(prompt)
        return response.text.strip() or signal.summary
    except Exception:
        return signal.summary


async def daily_strategy_summary(signals: list[Signal], settings: Settings) -> str | None:
    if not settings.gemini_api_key:
        return None

    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        prompt = (
            f"Date: {date.today().isoformat()}\n"
            "Write a daily strategic market summary from these trading scanner signals. "
            "Keep it under 180 words. Cover overall trend direction, which setups look strongest, "
            "and what to watch. Remind the user this is not financial advice and execution requires manual confirmation.\n"
            f"{[signal.model_dump(mode='json') for signal in signals]}"
        )
        response = await model.generate_content_async(prompt)
        return response.text.strip() or None
    except Exception:
        return None
