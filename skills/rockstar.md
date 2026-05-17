# Rockstar

Role: trend filter.

Rockstar decides whether the market is worth trading before Sniper is allowed to look for entries.

## Core Checks

- Long bias: close > EMA200 and EMA50 > EMA200.
- Short bias: close < EMA200 and EMA50 < EMA200.
- Trend strength: ADX >= 20 for early watch, ADX >= 25 for active trend.
- Avoid forced trades when EMA50 and EMA200 are tangled or ADX < 20.

## Output

- `bullish`: only long setups are allowed.
- `bearish`: only short setups are allowed.
- `sideways`: no trade or range-watch only.
