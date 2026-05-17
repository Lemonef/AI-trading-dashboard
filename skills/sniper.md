# Sniper

Role: entry trigger.

Sniper is only active after Rockstar has confirmed the trend regime.

## Long Trigger

- Close breaks above the previous 20-period high.
- Volume is at least 1.3x the 30-period average.
- MACD is above the MACD signal line.
- RSI is between 52 and 72.

## Short Trigger

- Close breaks below the previous 20-period low.
- Volume is at least 1.3x the 30-period average.
- MACD is below the MACD signal line.
- RSI is between 28 and 48.

## Output

- `long_setup`
- `short_setup`
- `watch`
- `no_trade`
