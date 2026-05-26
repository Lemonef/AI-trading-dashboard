import pytest
from unittest.mock import AsyncMock, patch
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
