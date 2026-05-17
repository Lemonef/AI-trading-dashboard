# Architect

Role: TP/SL and risk management.

Architect turns a scanner signal into a trade plan, without executing it.

## Defaults

- Use ATR for adaptive levels.
- Long setup: TP = close + 2.2 ATR, SL = close - 1.1 ATR.
- Short setup: TP = close - 2.2 ATR, SL = close + 1.1 ATR.
- Minimum expected reward:risk should be near 2:1.

## Safety

- No entry is valid without invalidation.
- Position sizing is intentionally left to the user until account context is available.
- The system must not place orders automatically.
