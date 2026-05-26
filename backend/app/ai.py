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

    enrichment = signal.enrichment if hasattr(signal, "enrichment") else {}
    galaxy = enrichment.get("galaxy_score")
    alt_rank = enrichment.get("alt_rank")
    sentiment_pct = enrichment.get("sentiment")
    fear_greed = enrichment.get("fear_greed_value")
    fear_greed_label = enrichment.get("fear_greed_label", "")
    btc_dom = enrichment.get("btc_dominance")

    sentiment_line = ""
    if galaxy is not None:
        sentiment_line = (
            f"Social: Galaxy Score {galaxy}/100, Alt Rank #{alt_rank}, "
            f"Sentiment {sentiment_pct}% bullish. "
        )
    macro_line = ""
    if fear_greed is not None:
        macro_line = f"Macro: Fear/Greed {fear_greed} ({fear_greed_label}), BTC dom {btc_dom}%. "

    skill_context = _load_skills(settings)

    prompt = (
        f"{skill_context}\n\n"
        "---\n\n"
        "You are a trading analyst. Using the IDS framework and Investor DNA above, "
        f"write a focused signal brief for {signal.symbol} tailored to DNA: {settings.investor_dna}.\n\n"
        f"DATA:\n"
        f"- Trend: {signal.trend} | Action: {signal.action.replace('_', ' ')} | Confidence: {round(signal.confidence * 100)}%\n"
        f"- EMA50 {'above' if ema50 > ema200 else 'below'} EMA200 | ADX {round(adx)} ({'strong' if adx >= 25 else 'weak'}) | RSI {round(rsi)} | Vol {round(vol, 1)}x\n"
        f"- TP: {signal.tp} | SL: {signal.sl}\n"
        + (f"- {macro_line}\n" if macro_line else "")
        + (f"- {sentiment_line}\n" if sentiment_line else "")
        + f"\nReasons: {'; '.join(signal.reasons[:3])}\n\n"
        "Write exactly 3 sentences then a score line:\n"
        "1. REGIME (IDS Layer 1+2): trend context + ADX/RSI read\n"
        "2. SETUP (IDS Layer 3): what triggered, what's missing, sentiment if available\n"
        "3. VERDICT: TP/SL levels + one action note for this DNA profile. End: 'Not financial advice — user must confirm.'\n"
        "Score: X/10 — one word (e.g. 'Score: 6/10 — fragmented'). Rate overall setup quality 1–10 based on trend strength, trigger clarity, and sentiment alignment.\n\n"
        "Under 130 words. Specific numbers. English only."
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
                    "max_tokens": 300,
                    "temperature": 0.4,
                },
            )
            if res.status_code == 429:
                print(f"  [Groq 429] {signal.symbol} — rate limit hit")
                from app.alerts import send_system_alert
                await send_system_alert(
                    f"⚠️ Groq AI rate limit hit ({signal.symbol})\n"
                    "Free tier: 30 req/min, 14,400 req/day on llama-3.1-8b.\n"
                    "Falling back to Gemini if available.",
                    settings,
                )
                if settings.gemini_api_key:
                    return await _gemini_signal_summary(signal, settings)
                return signal.summary, False
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
                delay = 15 * (attempt + 1)
                print(f"  [Gemini 429] {signal.symbol} — waiting {delay}s…")
                if attempt == 0:
                    from app.alerts import send_system_alert
                    await send_system_alert(
                        f"⚠️ Gemini AI rate limit hit ({signal.symbol})\n"
                        "Retrying with backoff. If this persists, free tier quota may be exhausted.",
                        settings,
                    )
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


def _load_skills(settings: Settings) -> str:
    """Load condensed IDS + DNA skill files. Full files exceed free-tier TPM."""
    skills_dir = settings.skills_dir
    parts: list[str] = []
    # Limit each file to first 2500 chars to stay within token budget
    for name in ["Investor-Decision-Stack-SKILL.md", "Investor-DNA-SKILL.md", "Legends-SKILL.md"]:
        path = skills_dir / name
        if path.exists():
            content = path.read_text(encoding="utf-8")[:2500]
            parts.append(f"# {name} (condensed)\n{content}")
    return "\n\n---\n\n".join(parts)


async def _groq_daily_summary(signals: list[Signal], settings: Settings) -> str | None:
    import httpx

    skill_context = _load_skills(settings)

    # Top candidates: sort by confidence, take top 5 active setups first, then watches
    active = sorted(
        [s for s in signals if s.action in {"long_setup", "short_setup"}],
        key=lambda s: s.confidence, reverse=True
    )
    watches = sorted(
        [s for s in signals if s.action == "watch"],
        key=lambda s: s.confidence, reverse=True
    )
    candidates = (active + watches)[:7]

    candidate_lines = []
    for i, s in enumerate(candidates, 1):
        ind = s.indicators or {}
        candidate_lines.append(
            f"Candidate {i}: {s.symbol} | action={s.action} | trend={s.trend} | "
            f"confidence={round(s.confidence * 100)}% | close={s.close} | "
            f"TP={s.tp} | SL={s.sl} | "
            f"EMA50={ind.get('ema50')} | EMA200={ind.get('ema200')} | "
            f"ADX={round(ind.get('adx') or 0)} | RSI={round(ind.get('rsi') or 50)} | "
            f"MACD={ind.get('macd')} | volume_ratio={round(ind.get('volume_ratio') or 0, 1)}x | "
            f"ATR={ind.get('atr')} | reasons: {'; '.join(s.reasons[:2])}"
        )

    prompt = f"""You are an AI trading analyst. Use the Investor Decision Stack (IDS) and Investor DNA frameworks from the skill files below.

{skill_context}

---

TODAY: {date.today().isoformat()}
USER DNA: {settings.investor_dna}

SCANNER SIGNALS:
{chr(10).join(candidate_lines)}

ALL SIGNALS SUMMARY:
{', '.join(f"{s.symbol}({s.action})" for s in signals)}

---

Generate a full IDS §11 Daily Report following the exact format from the skill files.
Include:
1. Macro environment read (derive from ADX/trend data across all signals)
2. Top 3-5 candidates with full 4-layer analysis (Macro/Regime/Setup/Catalyst)
3. Setup score /10 with progress bars for each candidate
4. Decision box (GO/WAIT/NO TRADE) color-coded verdict
5. For EACH candidate, include a section: "Strategy by Type" with 3 rows:
   - 🔥 Rockstar (Trend Rider): [what this strategy says about this signal]
   - 🎯 Sniper (Speed Racer): [entry trigger assessment]
   - 🏔️ Watcher (Patient Investor): [long-term view]
6. Action by position state (Flat / Long low cb / Long high cb)
7. Entry trigger + Invalidation conditions
8. Blind-spot warning

Use the §11 markdown format with emoji anchors (🌍🌡️🎯⚡🟢🟡🔴).
Write in English. Include Thai phrases naturally where they add clarity.
Keep each candidate focused and scannable.
End with overall DNA advice for {settings.investor_dna}."""

    try:
        print(f"[Groq daily] generating §11 report for {len(candidates)} candidates…")
        async with httpx.AsyncClient(timeout=60) as client:
            res = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": "llama-3.1-8b-instant",  # 131k TPM vs 12k for 70b
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 1500,
                    "temperature": 0.4,
                },
            )
            res.raise_for_status()
            text = res.json()["choices"][0]["message"]["content"].strip()
            print(f"[Groq daily] OK — {len(text)} chars")
            return text or None
    except Exception as exc:
        print(f"[Groq daily ERROR] {type(exc).__name__}: {str(exc)[:200]}")
        return None
