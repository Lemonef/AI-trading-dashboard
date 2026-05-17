import asyncio
from datetime import date

from app.config import Settings
from app.models import Signal

# Rate limit: free tier = 15 req/min → 1 every 4s to stay safe
_RATE_LIMIT_SLEEP = 4.0


def _has_ai(settings: Settings) -> bool:
    return bool(settings.gemini_api_key or settings.groq_api_key)


async def summarize_signal(signal: Signal, settings: Settings) -> str:
    """Called during scan — uses template only. AI runs via --summarize button."""
    return signal.summary


async def force_summarize_signal(signal: Signal, settings: Settings) -> tuple[str, bool]:
    """Called on demand — always runs AI. Returns (summary, was_ai_generated)."""
    if not _has_ai(settings):
        return signal.summary, False
    await asyncio.sleep(_RATE_LIMIT_SLEEP)
    return await _ai_summary(signal, settings)


async def _ai_summary(signal: Signal, settings: Settings) -> tuple[str, bool]:
    """Route to Groq first (higher quota), fall back to Gemini."""
    if settings.groq_api_key:
        return await _groq_signal_summary(signal, settings)
    return await _gemini_signal_summary(signal, settings)


async def _groq_signal_summary(signal: Signal, settings: Settings) -> tuple[str, bool]:
    import httpx

    ind = signal.indicators or {}
    ema50 = ind.get("ema50") or 0
    ema200 = ind.get("ema200") or 0
    adx = ind.get("adx") or 0
    rsi = ind.get("rsi") or 50
    vol = ind.get("volume_ratio") or 0

    prompt = (
        "You are a trading analyst using the Investor Decision Stack (IDS) framework.\n\n"
        f"Write exactly 3 sentences for {signal.symbol}:\n"
        f"1. REGIME: trend={signal.trend}, EMA50 {'above' if ema50 > ema200 else 'below'} EMA200, ADX {round(adx)} ({'strong' if adx >= 25 else 'weak'}), RSI {round(rsi)}.\n"
        f"2. SETUP: signal={signal.action.replace('_', ' ')}, confidence={round(signal.confidence * 100)}%, volume {round(vol, 1)}x. Key conditions met or missing.\n"
        f"3. VERDICT: TP={signal.tp}, SL={signal.sl}. End with 'Not financial advice — user must confirm.'\n\n"
        "Under 90 words. Specific numbers. English only."
    )

    try:
        print(f"  [Groq] calling for {signal.symbol}…")
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 200,
                    "temperature": 0.4,
                },
            )
            res.raise_for_status()
            text = res.json()["choices"][0]["message"]["content"].strip()
            if text:
                print(f"  [Groq] OK — {len(text)} chars: {text[:80]}…")
                return text, True
            return signal.summary, False
    except Exception as exc:
        print(f"  [Groq ERROR] {signal.symbol}: {type(exc).__name__}: {str(exc)[:120]}")
        # Fall back to Gemini if available
        if settings.gemini_api_key:
            return await _gemini_signal_summary(signal, settings)
        return signal.summary, False


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
    if not _has_ai(settings):
        return None

    if settings.groq_api_key:
        return await _groq_daily_summary(signals, settings)

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


async def _groq_daily_summary(signals: list[Signal], settings: Settings) -> str | None:
    import httpx

    signal_data = [
        f"{s.symbol}: {s.action} {s.trend} conf={round(s.confidence * 100)}% TP={s.tp} SL={s.sl}"
        for s in signals
    ]
    prompt = (
        f"Date: {date.today().isoformat()}\n"
        "Write a daily strategic market summary from these scanner signals. "
        "Under 180 words. Cover trend direction, strongest setups, what to watch. "
        "Not financial advice — execution requires manual confirmation.\n\n"
        + "\n".join(signal_data)
    )

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 300,
                    "temperature": 0.5,
                },
            )
            res.raise_for_status()
            return res.json()["choices"][0]["message"]["content"].strip() or None
    except Exception as exc:
        print(f"[Groq daily ERROR] {type(exc).__name__}: {str(exc)[:120]}")
        return None
