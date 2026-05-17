from datetime import date

from app.config import Settings
from app.models import Signal


async def summarize_signal(signal: Signal, settings: Settings) -> str:
    """Called during scan — only runs when signal.changed is True."""
    if not settings.gemini_api_key or not signal.changed:
        return signal.summary
    text, _ = await _gemini_signal_summary(signal, settings)
    return text


async def force_summarize_signal(signal: Signal, settings: Settings) -> tuple[str, bool]:
    """Called on demand — always runs Gemini. Returns (summary, was_ai_generated)."""
    if not settings.gemini_api_key:
        return signal.summary, False
    return await _gemini_signal_summary(signal, settings)


async def _gemini_signal_summary(signal: Signal, settings: Settings) -> tuple[str, bool]:
    try:
        import google.generativeai as genai

        genai.configure(api_key=settings.gemini_api_key)
        model = genai.GenerativeModel("gemini-2.0-flash")

        ind = signal.indicators or {}
        ema50 = ind.get("ema50") or 0
        ema200 = ind.get("ema200") or 0
        adx = ind.get("adx") or 0
        rsi = ind.get("rsi") or 50
        vol = ind.get("volume_ratio") or 0

        # Pre-build context strings outside f-string to avoid set-literal bug
        ema_pos = "above" if ema50 > ema200 else "below"
        adx_label = "strong trend" if adx >= 25 else "weak/no trend"
        action_label = signal.action.replace("_", " ")
        signal_json = signal.model_dump_json()

        prompt = (
            "You are a trading analyst using the Investor Decision Stack (IDS) framework: Macro → Regime → Setup → Risk.\n\n"
            f"Analyze this signal for {signal.symbol} and write exactly 3 sentences:\n\n"
            f"1. REGIME: State the trend ({signal.trend}), EMA position (EMA50 {ema_pos} EMA200), "
            f"ADX {round(adx)} ({adx_label}), RSI {round(rsi)}.\n"
            f"2. SETUP: Describe the signal ({action_label}, confidence {round(signal.confidence * 100)}%). "
            f"Mention key trigger conditions met or missing. Volume ratio {round(vol, 1)}x.\n"
            f"3. VERDICT: State action clearly. Include TP {signal.tp} and SL {signal.sl} if set. "
            f"End with: 'Not financial advice — user must confirm.'\n\n"
            "Rules: under 90 words total. Specific numbers. No vague language. English only.\n\n"
            f"Signal data: {signal_json}"
        )

        print(f"  [Gemini] calling API for {signal.symbol}…")
        response = await model.generate_content_async(prompt)
        text = response.text.strip()
        if text:
            print(f"  [Gemini] OK — {len(text)} chars: {text[:80]}…")
            return text, True
        print(f"  [Gemini] empty response")
        return signal.summary, False

    except Exception as exc:
        print(f"  [Gemini ERROR] {signal.symbol}: {type(exc).__name__}: {exc}")
        return signal.summary, False


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
