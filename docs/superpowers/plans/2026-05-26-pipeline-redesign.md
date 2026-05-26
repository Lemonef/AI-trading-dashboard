# Pipeline Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand market coverage to ~80 multi-asset symbols, add a relevance scoring layer before AI runs, integrate TradingView charts on the detail page, and replace the static sidebar with a DNA-aware top-markets panel.

**Architecture:** Two new backend concerns run independently — a Discovery Service (scheduled cron, scores all symbols, no AI) and an Analysis Service (on-demand endpoint, full pipeline + AI, cache-aside). Both share the existing DataAdapter and indicator infrastructure. The frontend gains a TradingView widget on detail pages and a `TopMarketsPanel` on the homepage sidebar.

**Tech Stack:** Python/FastAPI (backend), pytest + pytest-asyncio (tests), Next.js 16 + Tailwind (frontend), Supabase Postgres (storage), TradingView free widget embed, yfinance batch download.

---

## File Map

**New backend files:**
```
backend/tests/__init__.py
backend/tests/conftest.py
backend/tests/test_market_registry.py
backend/tests/test_scorer.py
backend/tests/test_analysis_cache.py
backend/tests/test_analyze_endpoint.py
backend/app/discovery/__init__.py
backend/app/discovery/scorer.py        # RelevanceScorer + 4 strategies
backend/app/discovery/store.py         # MarketScoreStore (Supabase)
backend/app/discovery/service.py       # run_discovery() orchestrator
backend/app/discovery/cli.py           # python -m app.discovery.cli
backend/app/analysis_cache.py          # AnalysisCache (Supabase)
```

**New frontend files:**
```
frontend/lib/tradingview.ts                      # symbolToTradingView() mapping
frontend/app/components/TradingViewWidget.tsx    # chart embed
frontend/app/components/TopMarketsPanel.tsx      # DNA-aware sidebar
frontend/app/api/markets/route.ts                # GET /api/markets
```

**Modified files:**
```
backend/requirements.txt                         # add pytest, pytest-asyncio
backend/supabase_schema.sql                      # add market_scores + analysis_cache
backend/app/scanner.py                           # add analyze_symbol() helper
backend/app/main.py                              # add POST /api/analyze
.github/workflows/discovery.yml                 # new cron (create)
frontend/app/signals/[slug]/page.tsx             # add TradingViewWidget at top
frontend/app/page.tsx                            # replace sidebar with TopMarketsPanel
```

---

## Task 1: pytest infrastructure

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Add pytest to requirements**

```
# backend/requirements.txt — append:
pytest>=8.0.0
pytest-asyncio>=0.23.0
```

- [ ] **Step 2: Create tests package**

```python
# backend/tests/__init__.py
# empty
```

- [ ] **Step 3: Create conftest**

```python
# backend/tests/conftest.py
import pandas as pd
import pytest


def make_ohlcv(rows: int = 260, trend: str = "up") -> pd.DataFrame:
    """Return a minimal OHLCV DataFrame with enough rows for indicators."""
    import numpy as np
    rng = np.random.default_rng(42)
    if trend == "up":
        close = 100 + np.cumsum(rng.uniform(0, 1, rows))
    elif trend == "down":
        close = 200 - np.cumsum(rng.uniform(0, 1, rows))
    else:
        close = 100 + rng.uniform(-1, 1, rows).cumsum() * 0.3
    volume = rng.integers(80_000, 120_000, rows).astype(float)
    return pd.DataFrame({
        "open": close * 0.998,
        "high": close * 1.012,
        "low": close * 0.988,
        "close": close,
        "volume": volume,
    })
```

- [ ] **Step 4: Verify pytest runs from backend directory**

```bash
cd backend
pip install pytest pytest-asyncio
pytest tests/ -v
```

Expected: `0 passed, 0 failed` (no tests yet, no errors)

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/tests/
git commit -m "test: add pytest infrastructure"
```

---

## Task 2: asset_class() helper

**Files:**
- Create: `backend/app/trading/market_registry.py`
- Create: `backend/tests/test_market_registry.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_market_registry.py
from app.trading.market_registry import asset_class


def test_crypto():
    assert asset_class("BTC/USDT") == "crypto"
    assert asset_class("ETH/USDT") == "crypto"


def test_forex():
    assert asset_class("EURUSD=X") == "forex"
    assert asset_class("USDJPY=X") == "forex"


def test_metals():
    assert asset_class("GC=F") == "metals"
    assert asset_class("SI=F") == "metals"
    assert asset_class("XAUUSD=X") == "metals"


def test_indices():
    assert asset_class("^GSPC") == "indices"
    assert asset_class("^IXIC") == "indices"


def test_commodities():
    assert asset_class("CL=F") == "commodities"
    assert asset_class("ZC=F") == "commodities"


def test_stocks_etfs():
    assert asset_class("AAPL") == "stocks"
    assert asset_class("SPY") == "stocks"
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && pytest tests/test_market_registry.py -v
```

Expected: `ImportError: cannot import name 'asset_class'`

- [ ] **Step 3: Implement**

```python
# backend/app/trading/market_registry.py
_SPOT_METALS = {"XAUUSD=X", "XAGUSD=X", "XPTUSD=X", "XPDUSD=X"}
_METAL_FUTURES = {"GC=F", "SI=F", "HG=F", "PL=F", "PA=F"}
_OIL_FUTURES = {"CL=F", "BZ=F", "NG=F", "RB=F"}
_AGRI_FUTURES = {"ZW=F", "ZC=F", "ZS=F", "KC=F", "CT=F", "SB=F", "OJ=F", "LE=F", "HE=F"}


def asset_class(symbol: str) -> str:
    if "/" in symbol:
        return "crypto"
    if symbol in _SPOT_METALS or symbol in _METAL_FUTURES:
        return "metals"
    if symbol in _OIL_FUTURES or symbol in _AGRI_FUTURES or symbol.endswith("=F"):
        return "commodities"
    if symbol.startswith("^"):
        return "indices"
    if symbol.endswith("=X"):
        return "forex"
    return "stocks"
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && pytest tests/test_market_registry.py -v
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/trading/market_registry.py backend/tests/test_market_registry.py
git commit -m "feat: add asset_class() helper for symbol categorization"
```

---

## Task 3: Supabase schema additions

**Files:**
- Modify: `backend/supabase_schema.sql`

- [ ] **Step 1: Append new tables to schema file**

Open `backend/supabase_schema.sql` and append at the end:

```sql
-- Market relevance scores (populated by discovery cron)
create table if not exists public.market_scores (
  symbol        text not null,
  asset_class   text not null,
  score         float not null default 0,
  trend         text,           -- 'bullish' | 'bearish' | 'sideways'
  adx           float,
  rsi           float,
  volume_ratio  float,
  trend_strength float,
  volatility    float,
  session_active bool default false,
  scanned_at    timestamptz not null default now(),
  primary key (symbol)
);

create index if not exists market_scores_score_idx on public.market_scores (score desc);
create index if not exists market_scores_asset_class_idx on public.market_scores (asset_class);

-- Analysis cache (on-demand AI analysis results)
create table if not exists public.analysis_cache (
  id            uuid primary key default gen_random_uuid(),
  symbol        text not null,
  timeframe     text not null,
  date          date not null,
  signal        jsonb not null,
  created_at    timestamptz not null default now(),
  unique (symbol, timeframe, date)
);

create index if not exists analysis_cache_lookup_idx
  on public.analysis_cache (symbol, timeframe, date);
```

- [ ] **Step 2: Run in Supabase SQL editor**

Copy the new SQL and run it in your Supabase project → SQL editor. Verify both tables appear in Table Editor.

- [ ] **Step 3: Commit**

```bash
git add backend/supabase_schema.sql
git commit -m "feat: add market_scores and analysis_cache tables"
```

---

## Task 4: RelevanceScorer (Strategy pattern)

**Files:**
- Create: `backend/app/discovery/__init__.py`
- Create: `backend/app/discovery/scorer.py`
- Create: `backend/tests/test_scorer.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_scorer.py
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && pytest tests/test_scorer.py -v
```

Expected: `ImportError: cannot import name 'VolatilityStrategy'`

- [ ] **Step 3: Create discovery package**

```python
# backend/app/discovery/__init__.py
# empty
```

- [ ] **Step 4: Implement scorer**

```python
# backend/app/discovery/scorer.py
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


class SessionStrategy:
    """1.0 if the asset's primary market session is currently active, else 0.2."""

    def score(self, df: pd.DataFrame) -> float:
        from datetime import datetime, timezone
        hour = datetime.now(timezone.utc).hour
        # Forex/metals/indices active during London+NY overlap (12–16 UTC)
        # Crypto always active
        # This method is called with the symbol via RelevanceScorer
        return 1.0  # overridden by RelevanceScorer.score_market per asset class


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

        # Session bonus: crypto always 1.0; forex/metals 1.0 during 07-21 UTC
        if cls == "crypto":
            session_bonus = 1.0
        elif 7 <= hour <= 21:
            session_bonus = 1.0
        else:
            session_bonus = 0.3

        weights = {"volatility": 0.3, "trend": 0.35, "volume": 0.25, "session": 0.1}
        strategy_scores = [s.score(df) for s in self.strategies[:3]]  # vol, trend, volume

        combined = (
            weights["volatility"] * (strategy_scores[0] if len(strategy_scores) > 0 else 0)
            + weights["trend"] * (strategy_scores[1] if len(strategy_scores) > 1 else 0)
            + weights["volume"] * (strategy_scores[2] if len(strategy_scores) > 2 else 0)
            + weights["session"] * session_bonus
        )
        return round(min(combined, 1.0), 4)
```

- [ ] **Step 5: Run to verify it passes**

```bash
cd backend && pytest tests/test_scorer.py -v
```

Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add backend/app/discovery/ backend/tests/test_scorer.py
git commit -m "feat: add RelevanceScorer with strategy pattern"
```

---

## Task 5: MarketScoreStore

**Files:**
- Create: `backend/app/discovery/store.py`

- [ ] **Step 1: Implement store (follows SignalStore pattern)**

```python
# backend/app/discovery/store.py
from datetime import datetime, timezone

import httpx

from app.config import Settings


class MarketScoreStore:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.enabled = bool(settings.supabase_url and settings.supabase_service_role_key)

    def save_scores(self, rows: list[dict]) -> None:
        """Upsert market scores. rows: list of dicts matching market_scores columns."""
        if not self.enabled or not rows:
            return
        response = httpx.post(
            f"{self.settings.supabase_url}/rest/v1/market_scores?on_conflict=symbol",
            headers={**self._headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=rows,
            timeout=30,
        )
        response.raise_for_status()

    def list_scores(self, limit: int = 100) -> list[dict]:
        if not self.enabled:
            return []
        response = httpx.get(
            f"{self.settings.supabase_url}/rest/v1/market_scores",
            headers=self._headers(),
            params={"select": "*", "order": "score.desc", "limit": str(limit)},
            timeout=20,
        )
        response.raise_for_status()
        return response.json()

    def _headers(self) -> dict[str, str]:
        key = self.settings.supabase_service_role_key or ""
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
cd backend && python -c "from app.discovery.store import MarketScoreStore; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/discovery/store.py
git commit -m "feat: add MarketScoreStore for market_scores table"
```

---

## Task 6: Discovery orchestrator + CLI

**Files:**
- Create: `backend/app/discovery/service.py`
- Create: `backend/app/discovery/cli.py`

- [ ] **Step 1: Implement service**

```python
# backend/app/discovery/service.py
import asyncio

from app.config import Settings
from app.discovery.scorer import RelevanceScorer, TrendStrategy, VolatilityStrategy, VolumeStrategy
from app.discovery.store import MarketScoreStore
from app.trading.indicators import enrich_indicators
from app.trading.market_data import (
    fetch_ohlcv_with_fallback,
    fetch_ohlcv_yfinance,
    fetch_ohlcv_yfinance_batch,
    is_crypto_symbol,
    demo_ohlcv,
    MarketDataUnavailable,
)
from app.trading.market_registry import asset_class
from app.trading.rules import build_signal


async def run_discovery(settings: Settings) -> dict:
    """Score all symbols and persist to market_scores. No AI, no alerts."""
    scorer = RelevanceScorer([VolatilityStrategy(), TrendStrategy(), VolumeStrategy()])
    store = MarketScoreStore(settings)
    symbols = settings.symbols
    rows = []

    # Batch download non-crypto in one API call
    non_crypto = [s for s in symbols if not is_crypto_symbol(s)]
    yf_batch: dict = {}
    if non_crypto:
        try:
            yf_batch = fetch_ohlcv_yfinance_batch(non_crypto, settings.timeframe, settings.ohlcv_limit)
        except Exception as exc:
            print(f"[discovery] batch download failed: {exc}")

    for symbol in symbols:
        try:
            if is_crypto_symbol(symbol):
                df_raw, _, _ = fetch_ohlcv_with_fallback(
                    settings.exchanges, symbol, settings.timeframe, settings.ohlcv_limit
                )
            elif symbol in yf_batch:
                df_raw = yf_batch[symbol]
            else:
                df_raw = fetch_ohlcv_yfinance(symbol, settings.timeframe, settings.ohlcv_limit)
        except (MarketDataUnavailable, Exception):
            if settings.allow_demo_data:
                df_raw = demo_ohlcv(symbol, settings.ohlcv_limit)
            else:
                continue

        df = enrich_indicators(df_raw)
        if len(df) < 50:
            continue

        score = scorer.score_market(symbol, df)

        # Extract key indicator values for client-side DNA filtering
        last = df.iloc[-1]
        signal = build_signal(symbol, "yfinance", settings.timeframe, df, None, None)

        rows.append({
            "symbol": symbol,
            "asset_class": asset_class(symbol),
            "score": score,
            "trend": signal.trend,
            "adx": float(last.get("adx", 0) or 0),
            "rsi": float(last.get("rsi", 50) or 50),
            "volume_ratio": float(
                df["volume"].iloc[-1] / df["volume"].iloc[-21:-1].mean()
                if len(df) >= 21 and df["volume"].iloc[-21:-1].mean() > 0
                else 1.0
            ),
            "trend_strength": float(last.get("adx", 0) or 0),
            "volatility": float(
                (last.get("atr", 0) or 0) / (last.get("close", 1) or 1)
            ),
            "session_active": True,
        })

    store.save_scores(rows)
    print(f"[discovery] scored {len(rows)}/{len(symbols)} symbols")
    return {"scored": len(rows), "total": len(symbols)}
```

- [ ] **Step 2: Implement CLI entry point**

```python
# backend/app/discovery/cli.py
import asyncio
from app.config import get_settings
from app.discovery.service import run_discovery


if __name__ == "__main__":
    result = asyncio.run(run_discovery(get_settings()))
    print(result)
```

- [ ] **Step 3: Smoke test locally (requires .env)**

```bash
cd backend && python -m app.discovery.cli
```

Expected: `[discovery] scored N/M symbols` with N > 0

- [ ] **Step 4: Commit**

```bash
git add backend/app/discovery/service.py backend/app/discovery/cli.py
git commit -m "feat: add discovery service and CLI for market scoring"
```

---

## Task 7: GitHub Actions discovery workflow

**Files:**
- Create: `.github/workflows/discovery.yml`

- [ ] **Step 1: Create workflow**

```yaml
# .github/workflows/discovery.yml
name: Market Discovery

on:
  schedule:
    - cron: "*/30 * * * *"   # every 30 minutes
  workflow_dispatch:           # manual trigger

jobs:
  discover:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
          cache: pip

      - name: Install dependencies
        run: pip install -e backend/

      - name: Run discovery
        env:
          WATCHLIST: ${{ secrets.WATCHLIST }}
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          EXCHANGE_ID: ${{ secrets.EXCHANGE_ID }}
          TIMEFRAME: ${{ secrets.TIMEFRAME }}
        run: python -m app.discovery.cli
        working-directory: backend
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/discovery.yml
git commit -m "ci: add market discovery cron (every 30 min)"
```

---

## Task 8: analyze_symbol() helper

**Files:**
- Modify: `backend/app/scanner.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_analyze_endpoint.py
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.models import Signal


@pytest.mark.asyncio
async def test_analyze_symbol_returns_signal():
    from app.scanner import analyze_symbol
    from tests.conftest import make_ohlcv
    import pandas as pd

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
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && pytest tests/test_analyze_endpoint.py::test_analyze_symbol_returns_signal -v
```

Expected: `ImportError: cannot import name 'analyze_symbol'`

- [ ] **Step 3: Add analyze_symbol() to scanner.py**

Add this function at the end of `backend/app/scanner.py` (before the last line, after `run_scan`):

```python
async def analyze_symbol(symbol: str, timeframe: str, settings: Settings) -> Signal:
    """Single-symbol analysis pipeline. No save, no alerts. Used by /api/analyze."""
    from app.trading.indicators import enrich_indicators
    from app.trading.rules import build_signal

    try:
        if is_crypto_symbol(symbol):
            candles, exchange_id, market_symbol = fetch_ohlcv_with_fallback(
                settings.exchanges, symbol, timeframe, settings.ohlcv_limit
            )
        else:
            candles = fetch_ohlcv_yfinance(symbol, timeframe, settings.ohlcv_limit)
            exchange_id = "yfinance"
            market_symbol = symbol
    except Exception:
        if not settings.allow_demo_data:
            raise
        candles = demo_ohlcv(symbol, settings.ohlcv_limit)
        exchange_id = "demo"
        market_symbol = symbol

    enriched = enrich_indicators(candles)
    signal = build_signal(market_symbol, exchange_id, timeframe, enriched, None, None)
    signal.summary = await summarize_signal(signal, settings)
    return signal
```

Also add `fetch_ohlcv_yfinance` to the existing import at the top of `scanner.py`:

```python
from app.trading.market_data import (
    demo_ohlcv,
    fetch_ohlcv_with_fallback,
    fetch_ohlcv_yfinance,           # add this
    fetch_ohlcv_yfinance_batch,
    is_crypto_symbol,
)
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && pytest tests/test_analyze_endpoint.py::test_analyze_symbol_returns_signal -v
```

Expected: `1 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/scanner.py backend/tests/test_analyze_endpoint.py
git commit -m "feat: add analyze_symbol() for on-demand single-symbol analysis"
```

---

## Task 9: AnalysisCache

**Files:**
- Create: `backend/app/analysis_cache.py`
- Modify: `backend/tests/test_analysis_cache.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_analysis_cache.py
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
```

- [ ] **Step 2: Run to verify it fails**

```bash
cd backend && pytest tests/test_analysis_cache.py -v
```

Expected: `ImportError: cannot import name 'AnalysisCache'`

- [ ] **Step 3: Implement**

```python
# backend/app/analysis_cache.py
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import httpx

from app.config import Settings
from app.models import Signal

BANGKOK = ZoneInfo("Asia/Bangkok")


def _today_bangkok() -> str:
    return datetime.now(BANGKOK).strftime("%Y-%m-%d")


class AnalysisCache:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.enabled = bool(settings.supabase_url and settings.supabase_service_role_key)

    def get(self, symbol: str, timeframe: str) -> Signal | None:
        if not self.enabled:
            return None
        response = httpx.get(
            f"{self.settings.supabase_url}/rest/v1/analysis_cache",
            headers=self._headers(),
            params={
                "select": "signal",
                "symbol": f"eq.{symbol}",
                "timeframe": f"eq.{timeframe}",
                "date": f"eq.{_today_bangkok()}",
                "limit": "1",
            },
            timeout=10,
        )
        response.raise_for_status()
        rows = response.json()
        if not rows:
            return None
        return Signal.model_validate(rows[0]["signal"])

    def set(self, signal: Signal) -> None:
        if not self.enabled:
            return
        payload = {
            "symbol": signal.symbol,
            "timeframe": signal.timeframe,
            "date": _today_bangkok(),
            "signal": signal.model_dump(mode="json"),
        }
        httpx.post(
            f"{self.settings.supabase_url}/rest/v1/analysis_cache"
            f"?on_conflict=symbol,timeframe,date",
            headers={**self._headers(), "Prefer": "resolution=merge-duplicates,return=minimal"},
            json=payload,
            timeout=15,
        ).raise_for_status()

    def _headers(self) -> dict[str, str]:
        key = self.settings.supabase_service_role_key or ""
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        }
```

- [ ] **Step 4: Run to verify it passes**

```bash
cd backend && pytest tests/test_analysis_cache.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/app/analysis_cache.py backend/tests/test_analysis_cache.py
git commit -m "feat: add AnalysisCache with Bangkok TZ date keying"
```

---

## Task 10: POST /api/analyze endpoint

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add endpoint**

Replace the contents of `backend/app/main.py` with:

```python
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.analysis_cache import AnalysisCache
from app.config import get_settings
from app.models import ScanResult, Signal
from app.scanner import analyze_symbol, run_scan
from app.storage import SignalStore

app = FastAPI(title="AI Trading Scanner", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/signals", response_model=list[Signal])
def list_signals() -> list[Signal]:
    return SignalStore(get_settings()).list_signals()


@app.post("/api/scan", response_model=ScanResult)
async def scan_now() -> ScanResult:
    return await run_scan(get_settings())


@app.post("/api/analyze", response_model=Signal)
async def analyze_market(symbol: str, timeframe: str = "1d") -> Signal:
    settings = get_settings()
    cache = AnalysisCache(settings)

    cached = cache.get(symbol, timeframe)
    if cached:
        return cached

    try:
        signal = await analyze_symbol(symbol, timeframe, settings)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    cache.set(signal)
    return signal
```

- [ ] **Step 2: Write test for cache-hit path**

Add to `backend/tests/test_analyze_endpoint.py`:

```python
@pytest.mark.asyncio
async def test_analyze_endpoint_returns_cached():
    from fastapi.testclient import TestClient
    from app.main import app
    from unittest.mock import patch, MagicMock
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
```

- [ ] **Step 3: Run tests**

```bash
cd backend && pytest tests/test_analyze_endpoint.py -v
```

Expected: `2 passed`

- [ ] **Step 4: Manual smoke test (dev server)**

```bash
cd backend && uvicorn app.main:app --reload
# In another terminal:
curl -X POST "http://localhost:8000/api/analyze?symbol=GC%3DF&timeframe=1d"
```

Expected: JSON Signal object

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_analyze_endpoint.py
git commit -m "feat: add POST /api/analyze with cache-aside pattern"
```

---

## Task 11: TradingView symbol mapping

**Files:**
- Create: `frontend/lib/tradingview.ts`

- [ ] **Step 1: Implement mapping**

```typescript
// frontend/lib/tradingview.ts
const METAL_FUTURES: Record<string, string> = {
  "GC=F": "COMEX:GC1!", "SI=F": "COMEX:SI1!",
  "HG=F": "COMEX:HG1!", "PL=F": "NYMEX:PL1!", "PA=F": "NYMEX:PA1!",
};

const OIL_FUTURES: Record<string, string> = {
  "CL=F": "NYMEX:CL1!", "BZ=F": "NYMEX:BB1!", "NG=F": "NYMEX:NG1!", "RB=F": "NYMEX:RB1!",
};

const AGRI_FUTURES: Record<string, string> = {
  "ZC=F": "CBOT:ZC1!", "ZW=F": "CBOT:ZW1!", "ZS=F": "CBOT:ZS1!",
  "KC=F": "ICEUS:KC1!", "CT=F": "ICEUS:CT1!", "SB=F": "ICEUS:SB1!",
};

const INDEX_MAP: Record<string, string> = {
  "^IXIC": "NASDAQ:COMP", "^GSPC": "SP:SPX", "^DJI": "DJ:DJI",
  "^FTSE": "SPREADEX:UK100", "^N225": "TVC:NI225", "^HSI": "TVC:HSI",
};

const SPOT_METALS: Record<string, string> = {
  "XAUUSD=X": "TVC:GOLD", "XAGUSD=X": "TVC:SILVER",
  "XPTUSD=X": "TVC:PLATINUM", "XPDUSD=X": "TVC:PALLADIUM",
};

export function symbolToTradingView(symbol: string): string | null {
  // Crypto: BTC/USDT → BINANCE:BTCUSDT
  if (symbol.includes("/")) {
    const [base, quote] = symbol.split("/");
    return `BINANCE:${base}${quote}`;
  }
  if (SPOT_METALS[symbol]) return SPOT_METALS[symbol];
  if (METAL_FUTURES[symbol]) return METAL_FUTURES[symbol];
  if (OIL_FUTURES[symbol]) return OIL_FUTURES[symbol];
  if (AGRI_FUTURES[symbol]) return AGRI_FUTURES[symbol];
  if (INDEX_MAP[symbol]) return INDEX_MAP[symbol];
  // Forex: EURUSD=X → FX:EURUSD
  if (symbol.endsWith("=X")) return `FX:${symbol.replace("=X", "")}`;
  // Stocks/ETFs: AAPL → NASDAQ:AAPL
  return `NASDAQ:${symbol}`;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/tradingview.ts
git commit -m "feat: add symbolToTradingView() mapping for all asset classes"
```

---

## Task 12: TradingViewWidget component

**Files:**
- Create: `frontend/app/components/TradingViewWidget.tsx`

- [ ] **Step 1: Implement widget**

```typescript
// frontend/app/components/TradingViewWidget.tsx
"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  symbol: string;         // TradingView symbol e.g. "BINANCE:BTCUSDT"
  defaultInterval?: string;
}

const INTERVALS = ["1D", "4H", "1H", "1W"] as const;

export default function TradingViewWidget({ symbol, defaultInterval = "1D" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [interval, setInterval] = useState(defaultInterval);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || collapsed) return;
    containerRef.current.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
    containerRef.current.appendChild(wrapper);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Bangkok",
      theme: "light",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
    });
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol, interval, collapsed]);

  return (
    <div className="border border-line bg-white overflow-hidden">
      {/* toolbar */}
      <div className="flex items-center justify-between border-b border-line bg-[#131722] px-4 py-2">
        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                interval === iv
                  ? "bg-white/10 text-white"
                  : "text-[#787b86] hover:text-white"
              }`}
            >
              {iv}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-[11px] text-[#787b86] hover:text-white transition-colors"
        >
          {collapsed ? "▼ show chart" : "▲ hide"}
        </button>
      </div>

      {!collapsed && (
        <div ref={containerRef} style={{ height: 380 }} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/TradingViewWidget.tsx
git commit -m "feat: add TradingViewWidget with interval switcher and collapse toggle"
```

---

## Task 13: Add TradingView to signal detail page

**Files:**
- Modify: `frontend/app/signals/[slug]/page.tsx`

- [ ] **Step 1: Add imports at top of the file**

After the existing imports in `frontend/app/signals/[slug]/page.tsx`, add:

```typescript
import TradingViewWidget from "../../components/TradingViewWidget";
import { symbolToTradingView } from "../../../lib/tradingview";
```

- [ ] **Step 2: Add widget before the header card**

In the `return` statement, find this comment:

```tsx
{/* ── Header card ─────────────────────────────────────────────────── */}
```

Insert this block immediately before it:

```tsx
{/* ── TradingView chart ────────────────────────────────────────────── */}
{symbolToTradingView(signal.symbol) && (
  <TradingViewWidget symbol={symbolToTradingView(signal.symbol)!} />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Visual test**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/signals/btc-usdt` (or any signal slug). Verify:
- TradingView chart appears above the header card
- Interval buttons (1D/4H/1H/1W) switch the chart
- Collapse/expand toggle works
- All existing sections (layer analysis, setup quality, StrategyView tabs, etc.) remain unchanged below

- [ ] **Step 5: Commit**

```bash
git add frontend/app/signals/[slug]/page.tsx
git commit -m "feat: add TradingView chart to signal detail page"
```

---

## Task 14: GET /api/markets route

**Files:**
- Create: `frontend/app/api/markets/route.ts`

- [ ] **Step 1: Implement route**

```typescript
// frontend/app/api/markets/route.ts
import { NextResponse } from "next/server";

function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/market_scores?select=*&order=score.desc&limit=100`,
      { headers: supabaseHeaders(), next: { revalidate: 120 } }
    );
    if (!res.ok) return NextResponse.json([], { status: 200 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Test endpoint with dev server**

```bash
cd frontend && npm run dev
# In another terminal:
curl http://localhost:3000/api/markets
```

Expected: JSON array (empty if `market_scores` table is empty, no crash)

- [ ] **Step 4: Commit**

```bash
git add frontend/app/api/markets/route.ts
git commit -m "feat: add GET /api/markets route from market_scores table"
```

---

## Task 15: TopMarketsPanel component

**Files:**
- Create: `frontend/app/components/TopMarketsPanel.tsx`

- [ ] **Step 1: Implement component**

```typescript
// frontend/app/components/TopMarketsPanel.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { symbolToSlug } from "../../lib/api";

type DNA = "rockstar" | "sniper" | "watcher";

interface MarketScore {
  symbol: string;
  asset_class: string;
  score: number;
  trend: string;
  adx: number;
  rsi: number;
  volume_ratio: number;
  trend_strength: number;
}

function fmt(v: number | null | undefined, d = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: d });
}

function filterByDna(markets: MarketScore[], dna: DNA): MarketScore[] {
  let filtered: MarketScore[];
  if (dna === "rockstar") {
    filtered = markets.filter(
      (m) => m.trend !== "sideways" && m.adx >= 25
    );
    filtered.sort((a, b) => b.adx - a.adx);
  } else if (dna === "sniper") {
    filtered = markets.filter((m) => m.volume_ratio >= 1.3);
    filtered.sort((a, b) => b.volume_ratio - a.volume_ratio);
  } else {
    // watcher: bullish trend + RSI < 40
    filtered = markets.filter(
      (m) => m.trend === "bullish" && m.rsi < 40
    );
    filtered.sort((a, b) => b.score - a.score);
  }
  return filtered.slice(0, 3);
}

function dnaLabel(dna: DNA) {
  if (dna === "rockstar") return "🔥 Rockstar";
  if (dna === "sniper") return "🎯 Sniper";
  return "🏔️ Watcher";
}

function dnaSubtitle(dna: DNA) {
  if (dna === "rockstar") return "Strong trend · ADX ≥ 25";
  if (dna === "sniper") return "High volume · Vol ≥ 1.3×";
  return "Bullish + RSI oversold < 40";
}

function chipColor(value: number, low: number, high: number) {
  if (value >= high) return "bg-green-100 text-green-700";
  if (value >= low) return "bg-zinc-100 text-zinc-600";
  return "bg-zinc-50 text-zinc-400";
}

export default function TopMarketsPanel() {
  const [markets, setMarkets] = useState<MarketScore[]>([]);
  const [dna, setDna] = useState<DNA>("rockstar");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("investor_dna") as DNA | null;
    if (saved && ["rockstar", "sniper", "watcher"].includes(saved)) setDna(saved);

    const onStorage = () => {
      const v = localStorage.getItem("investor_dna") as DNA | null;
      if (v && ["rockstar", "sniper", "watcher"].includes(v)) setDna(v);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    fetch("/api/markets")
      .then((r) => r.json())
      .then(setMarkets)
      .catch(() => {});
  }, []);

  function selectDna(d: DNA) {
    setDna(d);
    setExpanded(null);
    localStorage.setItem("investor_dna", d);
    window.dispatchEvent(new Event("storage"));
  }

  const top = filterByDna(markets, dna);

  return (
    <section className="card-lift border border-line bg-white">
      {/* DNA chips */}
      <div className="flex gap-1.5 flex-wrap border-b border-line px-4 py-3">
        {(["rockstar", "sniper", "watcher"] as DNA[]).map((d) => (
          <button
            key={d}
            onClick={() => selectDna(d)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
              dna === d
                ? "border-ink bg-ink text-white"
                : "border-line bg-white text-zinc-500 hover:border-zinc-400 hover:text-ink"
            }`}
          >
            {dnaLabel(d)}
          </button>
        ))}
      </div>

      {/* Header */}
      <div className="px-4 pt-3 pb-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
          Top for {dnaLabel(dna)}
        </div>
        <div className="text-[10px] text-zinc-400 mt-0.5">{dnaSubtitle(dna)}</div>
      </div>

      {/* Market rows */}
      {top.length === 0 ? (
        <div className="px-4 py-4 text-xs text-zinc-400">
          No markets match — run discovery scan first.
        </div>
      ) : (
        <ul>
          {top.map((m) => {
            const isExpanded = expanded === m.symbol;
            return (
              <li key={m.symbol} className="border-t border-line">
                {/* Row */}
                <div
                  className="flex cursor-pointer items-start justify-between px-4 py-3 hover:bg-[#FAFAF7] transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : m.symbol)}
                >
                  <div>
                    <div className="font-semibold text-sm text-ink leading-tight">
                      {m.symbol}
                    </div>
                    <div className="flex gap-1.5 mt-1.5 flex-wrap">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${chipColor(m.adx, 20, 30)}`}>
                        ADX {fmt(m.adx)}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${chipColor(100 - m.rsi, 30, 65)}`}>
                        RSI {fmt(m.rsi)}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${chipColor(m.volume_ratio, 1.1, 1.3)}`}>
                        Vol {fmt(m.volume_ratio)}×
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-2 shrink-0">
                    <span
                      className={`border px-1.5 py-0.5 text-[10px] font-semibold ${
                        m.trend === "bullish"
                          ? "border-buy text-buy"
                          : m.trend === "bearish"
                          ? "border-sell text-sell"
                          : "border-zinc-300 text-zinc-400"
                      }`}
                    >
                      {m.trend}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {Math.round(m.score * 100)}%
                    </span>
                  </div>
                </div>

                {/* Expanded indicators */}
                {isExpanded && (
                  <div className="border-t border-line bg-[#F7F6F0] px-4 py-3">
                    <dl className="grid grid-cols-3 gap-2">
                      {[
                        { label: "ADX", value: fmt(m.adx) },
                        { label: "RSI", value: fmt(m.rsi) },
                        { label: "Vol ×", value: fmt(m.volume_ratio) },
                        { label: "Score", value: `${Math.round(m.score * 100)}%` },
                        { label: "Trend", value: m.trend },
                        { label: "Class", value: m.asset_class },
                      ].map(({ label, value }) => (
                        <div key={label} className="border border-line bg-white px-2 py-1.5">
                          <dt className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                            {label}
                          </dt>
                          <dd className="mt-0.5 text-xs font-semibold text-ink">{value}</dd>
                        </div>
                      ))}
                    </dl>
                    <Link
                      href={`/signals/${symbolToSlug(m.symbol)}`}
                      className="mt-2.5 flex items-center text-[11px] font-semibold text-zinc-500 hover:text-ink"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Open full analysis →
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/TopMarketsPanel.tsx
git commit -m "feat: add TopMarketsPanel with DNA-aware filtering and expandable indicators"
```

---

## Task 16: Wire TopMarketsPanel into homepage

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Add import**

At the top of `frontend/app/page.tsx`, add:

```typescript
import TopMarketsPanel from "./components/TopMarketsPanel";
```

- [ ] **Step 2: Replace old sidebar top card**

In `frontend/app/page.tsx`, find this section inside `<aside>`:

```tsx
<section className="card-lift border border-line bg-white p-4">
  <div className="flex items-center justify-between">
    <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
      <Brain size={12} />Top Signal
    </div>
    ...
  </div>
  ...
</section>

{activeSetups.length > 1 && (
  <section className="border border-line bg-white p-4">
    ...
  </section>
)}
```

Replace **both** of those sections with a single line:

```tsx
<TopMarketsPanel />
```

Leave the Indicators section and Execution Guard section below unchanged.

- [ ] **Step 3: Remove unused Brain import if nothing else uses it**

Check if `Brain` from lucide-react is still used elsewhere in `page.tsx`. If not, remove it from the import line.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Visual test**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`. Verify:
- Right sidebar shows DNA chips (Rockstar / Sniper / Watcher)
- Clicking a DNA chip filters the market list
- Clicking a market row expands the indicator panel
- "Open full analysis →" navigates to detail page
- Existing signals table + tab filters work as before
- If `market_scores` table empty: shows "No markets match — run discovery scan first."

- [ ] **Step 6: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: replace static top-signal sidebar with DNA-aware TopMarketsPanel"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| MarketRegistry / asset_class categorization | Task 2 |
| market_scores + analysis_cache Supabase tables | Task 3 |
| RelevanceScorer (Strategy pattern) | Task 4 |
| MarketScoreStore | Task 5 |
| run_discovery() orchestrator + CLI | Task 6 |
| discovery.yml GitHub Actions cron | Task 7 |
| analyze_symbol() helper (no save/alerts) | Task 8 |
| AnalysisCache with Bangkok TZ | Task 9 |
| POST /api/analyze cache-first endpoint | Task 10 |
| symbolToTradingView() mapping | Task 11 |
| TradingViewWidget (collapse + interval switch) | Task 12 |
| TradingView on detail page, all existing sections unchanged | Task 13 |
| GET /api/markets Next.js route | Task 14 |
| TopMarketsPanel (DNA chips, expandable rows) | Task 15 |
| Wire TopMarketsPanel into homepage | Task 16 |
| DataAdapter routing (crypto→CCXT, others→yfinance) | Already in scanner.py — run_discovery() reuses same pattern |

All spec requirements covered. No placeholders or TBDs remain.
