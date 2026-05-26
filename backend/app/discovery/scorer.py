from typing import Protocol
import pandas as pd


class ScoringStrategy(Protocol):
    def score(self, df: pd.DataFrame) -> float: ...


class VolatilityStrategy:
    """ATR as percentage of close price, normalized 0–1 (capped at 5%)."""

    def score(self, df: pd.DataFrame) -> float:
        atr = df["atr"].iloc[-1] if "atr" in df.columns else None
        close = df["close"].iloc[-1]
        if not atr or not close:
            return 0.0
        pct = atr / close
        return min(pct / 0.05, 1.0)


class TrendStrategy:
    """ADX strength normalized 0–1 (ADX 40 = 1.0)."""

    def score(self, df: pd.DataFrame) -> float:
        adx = df["adx"].iloc[-1] if "adx" in df.columns else None
        if adx is None:
            return 0.0
        return min(float(adx) / 40.0, 1.0)


class VolumeStrategy:
    """Volume ratio vs 20-period average, normalized 0–1 (2× = 1.0)."""

    def score(self, df: pd.DataFrame) -> float:
        if len(df) < 21:
            return 0.0
        recent_vol = df["volume"].iloc[-1]
        avg_vol = df["volume"].iloc[-21:-1].mean()
        if not avg_vol:
            return 0.0
        ratio = recent_vol / avg_vol
        return min((ratio - 1.0) / 1.0, 1.0) if ratio > 1.0 else 0.0


class RelevanceScorer:
    def __init__(self, strategies: list[ScoringStrategy]) -> None:
        self.strategies = strategies

    def score_market(self, symbol: str, df: pd.DataFrame) -> float:
        if df.empty or len(df) < 50:
            return 0.0
        from datetime import datetime, timezone
        from app.trading.market_registry import asset_class as get_class

        hour = datetime.now(timezone.utc).hour
        cls = get_class(symbol)

        if cls == "crypto":
            session_bonus = 1.0
        elif 7 <= hour <= 21:
            session_bonus = 1.0
        else:
            session_bonus = 0.3

        weights = {"volatility": 0.3, "trend": 0.35, "volume": 0.25, "session": 0.1}
        strategy_scores = [s.score(df) for s in self.strategies[:3]]

        combined = (
            weights["volatility"] * (strategy_scores[0] if len(strategy_scores) > 0 else 0)
            + weights["trend"] * (strategy_scores[1] if len(strategy_scores) > 1 else 0)
            + weights["volume"] * (strategy_scores[2] if len(strategy_scores) > 2 else 0)
            + weights["session"] * session_bonus
        )
        return round(min(combined, 1.0), 4)
