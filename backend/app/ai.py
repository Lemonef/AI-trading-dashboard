import asyncio
from datetime import date

from app.config import Settings
from app.models import Signal

# Groq free tier: 6,000 TPM on llama-3.1-8b-instant.
# Per-signal prompt ~350 tokens (150 input + 200 output) → ~17 calls/min safe.
# Use 6s spacing to stay under TPM ceiling with margin.
_RATE_LIMIT_SLEEP = 6.0

# Inline IDS cheatsheet — replaces loading full skill files per signal call (~1875 tokens saved).
_IDS_MINI = (
    "IDS: L1=Macro, L2=Regime(EMA/ADX), L3=Setup(pattern/vol), L4=Catalyst(trigger).\n"
    "Strategies: Rockstar=trend(EMA50>EMA200+ADX≥25), Sniper=breakout(vol≥1.3+MACD+RSI), Watcher=weekly regime."
)

# Circuit breakers — set True once quota exhausted to skip remaining calls
_groq_exhausted = False   # daily limit (14,400 req/day)
_gemini_exhausted = False  # daily quota (RESOURCE_EXHAUSTED)


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
    global _groq_exhausted
    if _groq_exhausted:
        if settings.gemini_api_key:
            return await _gemini_signal_summary(signal, settings)
        return signal.summary, False

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

    extras = []
    if galaxy is not None:
        extras.append(f"Galaxy:{galaxy}/100 AltRank:#{alt_rank} Sentiment:{sentiment_pct}%bull")
    if fear_greed is not None:
        extras.append(f"F/G:{fear_greed}({fear_greed_label}) BTCdom:{btc_dom}%")

    prompt = (
        f"{_IDS_MINI}\n\n"
        f"{signal.symbol}|DNA:{settings.investor_dna}\n"
        f"Trend:{signal.trend}|Action:{signal.action.replace('_',' ')}|Conf:{round(signal.confidence*100)}%\n"
        f"EMA50{'>' if ema50>ema200 else '<'}EMA200|ADX:{round(adx)}({'strong' if adx>=25 else 'weak'})|RSI:{round(rsi)}|Vol:{round(vol,1)}x\n"
        f"TP:{signal.tp}|SL:{signal.sl}"
        + (f"\n{' '.join(extras)}" if extras else "")
        + f"\nReasons:{';'.join(signal.reasons[:3])}\n\n"
        "3 sentences then exactly: Score: N/10 — oneword\n"
        "1.REGIME:trend+ADX/RSI 2.SETUP:trigger+gaps+sentiment 3.VERDICT:TP/SL+DNA action. End sentence 3 with 'Not financial advice — user must confirm.'\n"
        "<120 words total."
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
                # Use float() first — Groq returns "2.8" not "3", int("2.8") raises ValueError
                retry_after = int(float(res.headers.get("retry-after", 0)))
                err_body = res.text.lower()
                is_daily = "daily" in err_body or "exceeded" in err_body or retry_after > 120
                if is_daily:
                    _groq_exhausted = True
                    print(f"  [Groq 429] {signal.symbol} — daily quota exhausted, circuit open")
                    from app.alerts import send_system_alert
                    await send_system_alert(
                        f"⚠️ Groq daily quota exhausted ({signal.symbol}) — falling back to Gemini.",
                        settings,
                    )
                    if settings.gemini_api_key:
                        return await _gemini_signal_summary(signal, settings)
                    return signal.summary, False
                else:
                    # TPM hit — sleep the exact retry-after, then retry Groq (not Gemini)
                    wait = retry_after if retry_after > 0 else 5
                    print(f"  [Groq TPM] {signal.symbol} — sleeping {wait}s then retry")
                    await asyncio.sleep(wait)
                    # retry falls through — loop would require refactor; re-call self
                    return await _groq_signal_summary(signal, settings)
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
    global _gemini_exhausted
    if _gemini_exhausted:
        print(f"  [Gemini] skipping {signal.symbol} — quota circuit open")
        return signal.summary, False

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

            action_label = signal.action.replace("_", " ")

            prompt = (
                f"{_IDS_MINI}\n\n"
                f"{signal.symbol}|DNA:{settings.investor_dna}\n"
                f"Trend:{signal.trend}|Action:{action_label}|Conf:{round(signal.confidence*100)}%\n"
                f"EMA50{'>' if ema50>ema200 else '<'}EMA200|ADX:{round(adx)}({'strong' if adx>=25 else 'weak'})|RSI:{round(rsi)}|Vol:{round(vol,1)}x\n"
                f"TP:{signal.tp}|SL:{signal.sl}\n"
                f"Reasons:{';'.join(signal.reasons[:3])}\n\n"
                "3 sentences then exactly: Score: N/10 — oneword\n"
                "1.REGIME:trend+ADX/RSI 2.SETUP:trigger+gaps 3.VERDICT:TP/SL+DNA action. End sentence 3 with 'Not financial advice — user must confirm.'\n"
                "<90 words total."
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
            if "429" in err:
                is_quota = "resource_exhausted" in err.lower() or "quota" in err.lower()
                if is_quota:
                    # Daily quota gone — open circuit, no point retrying
                    _gemini_exhausted = True
                    print(f"  [Gemini] quota exhausted for {signal.symbol} — circuit open, skipping remaining")
                    from app.alerts import send_system_alert
                    await send_system_alert(
                        f"⚠️ Gemini daily quota exhausted ({signal.symbol})\n"
                        "Skipping Gemini for all remaining signals this run.",
                        settings,
                    )
                    return signal.summary, False
                if attempt < max_retries - 1:
                    delay = 15 * (attempt + 1)
                    print(f"  [Gemini 429] {signal.symbol} — rate limit, waiting {delay}s…")
                    if attempt == 0:
                        from app.alerts import send_system_alert
                        await send_system_alert(
                            f"⚠️ Gemini AI rate limit hit ({signal.symbol})\n"
                            "Retrying with backoff.",
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
