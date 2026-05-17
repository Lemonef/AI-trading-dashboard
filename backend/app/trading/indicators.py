import pandas as pd


def enrich_indicators(frame: pd.DataFrame) -> pd.DataFrame:
    df = frame.copy()
    df["ema50"] = df["close"].ewm(span=50, adjust=False).mean()
    df["ema200"] = df["close"].ewm(span=200, adjust=False).mean()
    df["rsi"] = _rsi(df["close"])
    macd_line, signal_line, histogram = _macd(df["close"])
    df["macd"] = macd_line
    df["macd_signal"] = signal_line
    df["macd_hist"] = histogram
    df["atr"] = _atr(df)
    df["adx"] = _adx(df)
    df["volume_avg30"] = df["volume"].rolling(30).mean()
    df["volume_ratio"] = df["volume"] / df["volume_avg30"]
    df["high20"] = df["high"].rolling(20).max()
    df["low20"] = df["low"].rolling(20).min()
    return df


def _rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss.replace(0, pd.NA)
    return 100 - (100 / (1 + rs))


def _macd(series: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    fast = series.ewm(span=12, adjust=False).mean()
    slow = series.ewm(span=26, adjust=False).mean()
    macd_line = fast - slow
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    return macd_line, signal_line, macd_line - signal_line


def _atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    previous_close = df["close"].shift(1)
    ranges = pd.concat(
        [
            df["high"] - df["low"],
            (df["high"] - previous_close).abs(),
            (df["low"] - previous_close).abs(),
        ],
        axis=1,
    )
    true_range = ranges.max(axis=1)
    return true_range.rolling(period).mean()


def _adx(df: pd.DataFrame, period: int = 14) -> pd.Series:
    high_delta = df["high"].diff()
    low_delta = -df["low"].diff()

    plus_dm = high_delta.where((high_delta > low_delta) & (high_delta > 0), 0.0)
    minus_dm = low_delta.where((low_delta > high_delta) & (low_delta > 0), 0.0)
    atr = _atr(df, period).replace(0, pd.NA)

    plus_di = 100 * plus_dm.rolling(period).sum() / atr
    minus_di = 100 * minus_dm.rolling(period).sum() / atr
    dx = ((plus_di - minus_di).abs() / (plus_di + minus_di).replace(0, pd.NA)) * 100
    return dx.rolling(period).mean()
