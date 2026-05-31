from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


Trend = Literal["bullish", "bearish", "sideways"]
Action = Literal["watch", "long_setup", "short_setup", "no_trade"]


class Signal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    symbol: str
    exchange: str
    timeframe: str
    close: float
    trend: Trend
    action: Action
    confidence: float
    summary: str
    tp: float | None = None
    sl: float | None = None
    changed: bool = False
    trend_changed: bool = False
    previous_action: str | None = None
    previous_trend: str | None = None
    ai_enhanced: bool = False
    ai_score: int | None = None
    ai_score_label: str | None = None
    indicators: dict[str, float | None] = Field(default_factory=dict)
    reasons: list[str] = Field(default_factory=list)
    enrichment: dict[str, float | str | None] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ScanResult(BaseModel):
    scanned: int
    changed: int
    signals: list[Signal]
