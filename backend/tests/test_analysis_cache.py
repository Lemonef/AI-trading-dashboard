from unittest.mock import MagicMock, patch
import pytest
from app.models import Signal


def _mock_settings():
    from app.config import Settings
    return Settings(supabase_url="https://x.supabase.co", supabase_service_role_key="key")


def test_cache_miss_returns_none():
    from app.analysis_cache import AnalysisCache
    cache = AnalysisCache(_mock_settings())
    with patch("httpx.get") as mock_get:
        mock_get.return_value = MagicMock(status_code=200, json=lambda: [])
        result = cache.get("BTC/USDT", "1d")
        assert result is None


def test_cache_hit_returns_signal():
    from app.analysis_cache import AnalysisCache
    import uuid
    from datetime import datetime, timezone
    cache = AnalysisCache(_mock_settings())
    signal_data = {
        "symbol": "BTC/USDT", "exchange": "binance", "timeframe": "1d",
        "close": 50000.0, "trend": "bullish", "action": "long_setup",
        "confidence": 0.8, "summary": "test", "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    with patch("httpx.get") as mock_get:
        mock_get.return_value = MagicMock(
            status_code=200, json=lambda: [{"signal": signal_data}]
        )
        result = cache.get("BTC/USDT", "1d")
        assert result is not None
        assert result.symbol == "BTC/USDT"
