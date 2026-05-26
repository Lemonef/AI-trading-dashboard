import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.models import Signal


@pytest.mark.asyncio
async def test_analyze_symbol_returns_signal():
    from app.scanner import analyze_symbol
    from tests.conftest import make_ohlcv

    df = make_ohlcv(260, "up")

    with patch("app.scanner.fetch_ohlcv_with_fallback", return_value=(df, "binance", "BTC/USDT")), \
         patch("app.scanner.summarize_signal", new_callable=AsyncMock, return_value="AI summary"):
        from app.config import Settings
        settings = Settings(
            supabase_url=None,
            supabase_service_role_key=None,
            gemini_api_key=None,
        )
        signal = await analyze_symbol("BTC/USDT", "1d", settings)
        assert isinstance(signal, Signal)
        assert signal.symbol == "BTC/USDT"


@pytest.mark.asyncio
async def test_analyze_endpoint_returns_cached():
    from fastapi.testclient import TestClient
    from app.main import app
    from unittest.mock import patch
    import uuid
    from datetime import datetime, timezone

    cached_signal = {
        "symbol": "GC=F", "exchange": "yfinance", "timeframe": "1d",
        "close": 2400.0, "trend": "bullish", "action": "long_setup",
        "confidence": 0.85, "summary": "cached", "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    with patch("app.main.AnalysisCache") as MockCache:
        instance = MockCache.return_value
        from app.models import Signal
        instance.get.return_value = Signal.model_validate(cached_signal)

        client = TestClient(app)
        response = client.post("/api/analyze?symbol=GC%3DF&timeframe=1d")
        assert response.status_code == 200
        assert response.json()["symbol"] == "GC=F"
