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
