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
