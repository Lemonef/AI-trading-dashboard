from datetime import date

from app.config import Settings
from app.models import Signal


async def summarize_signal(signal: Signal, settings: Settings) -> str:
    """Called during scan — only runs when signal.changed is True."""
    if not settings.gemini_api_key or not signal.changed:
        return signal.summary
    return await _gemini_signal_summary(signal, settings)


async def force_summarize_signal(signal: Signal, settings: Settings) -> str:
    """Called on demand — always runs Gemini regardless of changed status."""
    if not settings.gemini_api_key:
        return signal.summary
    return await _gemini_signal_summary(signal, settings)


async def _gemini_signal_summary(signal: Signal, settings: Settings) -> str:
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        ind = signal.indicators or {}
        ema50 = ind.get("ema50") or 0
        ema200 = ind.get("ema200") or 0
        adx = ind.get("adx") or 0
        rsi = ind.get("rsi") or 50
        vol = ind.get("volume_ratio") or 0

        prompt = f"""You are a trading analyst using the Investor Decision Stack (IDS) framework: Macro → Regime → Setup → Risk.

Analyze this signal for {signal.symbol} and write exactly 3 sentences:

1. REGIME: State the trend ({signal.trend}), EMA position (EMA50 {'above' if ema50 > ema200 else 'below'} EMA200), ADX {round(adx)} ({'strong trend' if adx >= 25 else 'weak/no trend'}), RSI {round(rsi)}.
2. SETUP: Describe the signal ({signal.action.replace('_', ' ')}, confidence {round(signal.confidence * 100)}%). Mention key trigger conditions met or missing. Volume ratio {round(vol, 1)}x.
3. VERDICT: State action clearly. Include TP {signal.tp} and SL {signal.sl} if set. R:R context. End with "Not financial advice — user must confirm."

Rules: under 90 words total. Specific numbers only. No vague language. English only.

Raw signal: {signal.model_dump_json(exclude={{'id', 'created_at'}})}"""

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
