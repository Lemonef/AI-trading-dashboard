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

// NYSE Arca ETFs — TradingView uses AMEX prefix for NYSE Arca
const AMEX_ETFS = new Set([
  "SPY", "IWM", "DIA",
  "XLE", "XLK", "XLF", "XLV", "XLI", "XLB", "XLU", "XLP", "XLY",
  "GLD", "SLV", "USO", "ARKK",
  "EWY", "EWT", "EEM", "VGK",
]);

// NYSE-listed stocks (not NASDAQ)
const NYSE_STOCKS = new Set(["PLTR", "NOW"]);

export function symbolToTradingView(symbol: string): string | null {
  if (symbol.includes("/")) {
    const [base, quote] = symbol.split("/");
    return `BINANCE:${base}${quote}`;
  }
  if (SPOT_METALS[symbol]) return SPOT_METALS[symbol];
  if (METAL_FUTURES[symbol]) return METAL_FUTURES[symbol];
  if (OIL_FUTURES[symbol]) return OIL_FUTURES[symbol];
  if (AGRI_FUTURES[symbol]) return AGRI_FUTURES[symbol];
  if (INDEX_MAP[symbol]) return INDEX_MAP[symbol];
  if (symbol.endsWith("=X")) return `FX:${symbol.replace("=X", "")}`;
  if (AMEX_ETFS.has(symbol)) return `AMEX:${symbol}`;
  if (NYSE_STOCKS.has(symbol)) return `NYSE:${symbol}`;
  return `NASDAQ:${symbol}`;
}
