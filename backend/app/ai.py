import asyncio
from datetime import date

from app.config import Settings
from app.models import Signal

# Rate limit: free tier = 15 req/min → 1 every 4s to stay safe
_RATE_LIMIT_SLEEP = 4.0


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
    await asyncio.sleep(_RATE_LIMIT_SLEEP)
    return await _gemini_signal_summary(signal, settings)


async def _gemini_signal_summary(signal: Signal, settings: Settings) -> tuple[str, bool]:
    max_retries = 3
    for attempt in range(max_retries):
        try:
            from google import genai

            client = genai.Client(api_key=settings.gemini_api_key)

            ind = signal.indicators or {}
            ema50 = ind.get("ema50") or 0
            ema200 = ind.get("ema200") or 0
            adx = ind.get("adx") or 0
            rsi = ind.get("rsi") or 50
            vol = ind.get("volume_ratio") or 0

            ema_pos = "above" if ema50 > ema200 else "below"
            adx_label = "strong trend" if adx >= 25 else "weak/no trend"
            action_label = signal.action.replace("_", " ")
            signal_json = signal.model_dump_json()

            prompt = (
                "You are a trading analyst using the Investor Decision Stack (IDS) framework.\n\n"
                f"Analyze this signal for {signal.symbol} and write exactly 3 sentences:\n"
                f"1. REGIME: trend={signal.trend}, EMA50 {ema_pos} EMA200, ADX {round(adx)} ({adx_label}), RSI {round(rsi)}.\n"
                f"2. SETUP: signal={action_label}, confidence={round(signal.confidence * 100)}%, volume ratio {round(vol, 1)}x. Key conditions met or missing.\n"
                f"3. VERDICT: TP={signal.tp}, SL={signal.sl}. End with 'Not financial advice — user must confirm.'\n\n"
                "Under 90 words total. Specific numbers. English only.\n\n"
                f"Data: {signal_json}"
            )

            print(f"  [Gemini] calling for {signal.symbol} (attempt {attempt + 1})…")
            response = await client.aio.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
            )
            text = response.text.strip() if response.text else ""
            if text:
                print(f"  [Gemini] OK — {len(text)} chars: {text[:80]}…")
                return text, True
            print(f"  [Gemini] empty response")
            return signal.summary, False

        except Exception as exc:
            err = str(exc)
            if "429" in err and attempt < max_retries - 1:
                # Extract retry delay from error or use exponential backoff
                delay = 15 * (attempt + 1)
                print(f"  [Gemini 429] {signal.symbol} — waiting {delay}s…")
                await asyncio.sleep(delay)
                continue
            print(f"  [Gemini ERROR] {signal.symbol}: {type(exc).__name__}: {err[:120]}")
            return signal.summary, False

    return signal.summary, False


async def daily_strategy_summary(signals: list[Signal], settings: Settings) -> str | None:
    if not settings.gemini_api_key:
        return None

    try:
        from google import genai

        client = genai.Client(api_key=settings.gemini_api_key)
        signal_data = [s.model_dump(mode="json") for s in signals]
        prompt = (
            f"Date: {date.today().isoformat()}\n"
            "Write a daily strategic market summary from these trading scanner signals. "
            "Keep it under 180 words. Cover overall trend direction, which setups look strongest, "
            "and what to watch. Not financial advice — execution requires manual confirmation.\n"
            f"{signal_data}"
        )
        response = await client.aio.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
        )
        return response.text.strip() if response.text else None
    except Exception as exc:
        print(f"[daily_summary ERROR] {type(exc).__name__}: {str(exc)[:120]}")
        return None
