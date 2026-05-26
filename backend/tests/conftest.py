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
