import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from tests.conftest import make_ohlcv
from app.trading.indicators import enrich_indicators
from app.discovery.scorer import (
    VolatilityStrategy,
    TrendStrategy,
    VolumeStrategy,
    RelevanceScorer,
)


def test_volatility_strategy_returns_float():
    df = enrich_indicators(make_ohlcv(260, "up"))
    score = VolatilityStrategy().score(df)
    assert 0.0 <= score <= 1.0


def test_trend_strategy_up_scores_higher_than_sideways():
    df_up = enrich_indicators(make_ohlcv(260, "up"))
    df_flat = enrich_indicators(make_ohlcv(260, "flat"))
    assert TrendStrategy().score(df_up) >= TrendStrategy().score(df_flat)


def test_volume_strategy_returns_float():
    df = enrich_indicators(make_ohlcv(260, "up"))
    score = VolumeStrategy().score(df)
    assert 0.0 <= score <= 1.0


def test_relevance_scorer_aggregates():
    df = enrich_indicators(make_ohlcv(260, "up"))
    scorer = RelevanceScorer([VolatilityStrategy(), TrendStrategy(), VolumeStrategy()])
    score = scorer.score_market("BTC/USDT", df)
    assert 0.0 <= score <= 1.0
