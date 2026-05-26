import math

import pandas as pd

from app.models import Action, Signal, Trend


def build_signal(symbol: str, exchange: str, timeframe: str, enriched: pd.DataFrame, previous_action: str | None, previous_trend: str | None = None) -> Signal:
    latest = enriched.iloc[-1]
    prior = enriched.iloc[-2]
    trend = _trend(latest)
    action, reasons = _action(latest, prior, trend)
    atr = _num(latest.get("atr"))
    close = float(latest["close"])
    tp, sl = _risk_levels(close, atr, action)
    confidence = _confidence(latest, trend, action)
    changed = previous_action is not None and previous_action != action
    trend_changed = previous_trend is not None and previous_trend != trend

    return Signal(
        symbol=symbol,
        exchange=exchange,
        timeframe=timeframe,
        close=close,
        trend=trend,
        action=action,
        confidence=confidence,
        summary=_default_summary(symbol, trend, action, reasons),
        tp=tp,
        sl=sl,
        changed=changed,
        trend_changed=trend_changed,
        previous_action=previous_action if changed else None,
        previous_trend=previous_trend if trend_changed else None,
        indicators={
            "ema50": _num(latest.get("ema50")),
            "ema200": _num(latest.get("ema200")),
            "macd": _num(latest.get("macd")),
            "macd_signal": _num(latest.get("macd_signal")),
            "adx": _num(latest.get("adx")),
            "rsi": _num(latest.get("rsi")),
            "atr": atr,
            "volume_ratio": _num(latest.get("volume_ratio")),
        },
        reasons=reasons,
    )


def _trend(row: pd.Series) -> Trend:
    ema50 = _num(row.get("ema50")) or 0
    ema200 = _num(row.get("ema200")) or 0
    adx = _num(row.get("adx")) or 0
    close = float(row["close"])
    if close > ema200 and ema50 > ema200 and adx >= 20:
        return "bullish"
    if close < ema200 and ema50 < ema200 and adx >= 20:
        return "bearish"
    return "sideways"


def _action(row: pd.Series, prior: pd.Series, trend: Trend) -> tuple[Action, list[str]]:
    reasons: list[str] = []
    close = float(row["close"])
    prior_high20 = _num(prior.get("high20")) or close
    prior_low20 = _num(prior.get("low20")) or close
    volume_ratio = _num(row.get("volume_ratio")) or 0
    macd = _num(row.get("macd")) or 0
    macd_signal = _num(row.get("macd_signal")) or 0
    rsi = _num(row.get("rsi")) or 50
    adx = _num(row.get("adx")) or 0

    if trend == "bullish":
        reasons.append("Rockstar trend filter: EMA50 above EMA200")
        if close > prior_high20 and volume_ratio >= 1.3 and macd > macd_signal and 52 <= rsi <= 72:
            reasons.extend(["Sniper trigger: 20-period breakout", "Volume expansion confirms move"])
            return "long_setup", reasons
        if adx >= 25:
            reasons.append("Trend is active; wait for clean trigger")
            return "watch", reasons

    if trend == "bearish":
        reasons.append("Rockstar trend filter: EMA50 below EMA200")
        if close < prior_low20 and volume_ratio >= 1.3 and macd < macd_signal and 28 <= rsi <= 48:
            reasons.extend(["Sniper trigger: 20-period breakdown", "Volume expansion confirms move"])
            return "short_setup", reasons
        if adx >= 25:
            reasons.append("Downtrend is active; wait for clean trigger")
            return "watch", reasons

    reasons.append("Watcher says regime is mixed or range-bound")
    return "no_trade", reasons


def _risk_levels(close: float, atr: float | None, action: Action) -> tuple[float | None, float | None]:
    if not atr or action not in {"long_setup", "short_setup", "watch"}:
        return None, None
    if action == "short_setup":
        return round(close - atr * 2.2, 4), round(close + atr * 1.1, 4)
    return round(close + atr * 2.2, 4), round(close - atr * 1.1, 4)


def _confidence(row: pd.Series, trend: Trend, action: Action) -> float:
    score = 0.25
    adx = _num(row.get("adx")) or 0
    volume_ratio = _num(row.get("volume_ratio")) or 0
    rsi = _num(row.get("rsi")) or 50

    if trend != "sideways":
        score += 0.2
    if action in {"long_setup", "short_setup"}:
        score += 0.22
    elif action == "watch":
        score += 0.1
    if adx >= 25:
        score += 0.12
    if volume_ratio >= 1.3:
        score += 0.12
    if 35 <= rsi <= 68:
        score += 0.09
    return round(min(score, 0.95), 2)


def _default_summary(symbol: str, trend: Trend, action: Action, reasons: list[str]) -> str:
    verdict = {
        "long_setup": "Long setup forming",
        "short_setup": "Short setup forming",
        "watch": "Trend is active but trigger is not clean yet",
        "no_trade": "No trade zone",
    }[action]
    return f"{symbol}: {verdict}. Trend is {trend}. {'; '.join(reasons[:2])}."


def _num(value: object) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number):
        return None
    return number
