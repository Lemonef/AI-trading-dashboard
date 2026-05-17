import { NextRequest, NextResponse } from "next/server";

// Map scanner symbol format → Yahoo Finance symbol
function toYFSymbol(symbol: string): string {
  if (symbol.includes("/")) {
    // BTC/USDT → BTC-USD, ETH/USD → ETH-USD
    const base = symbol.split("/")[0];
    return `${base}-USD`;
  }
  return symbol; // AAPL, EURUSD=X, GC=F, etc — unchanged
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").filter(Boolean);
  if (!symbols.length) return NextResponse.json({});

  // Build original→YF symbol map and deduplicate
  const yfMap: Record<string, string> = {};
  for (const s of symbols) yfMap[s] = toYFSymbol(s);
  const yfSymbols = [...new Set(Object.values(yfMap))].join(",");

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yfSymbols)}&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,currency,shortName`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          "Accept-Language": "en-US,en;q=0.9",
        },
        next: { revalidate: 60 },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo Finance returned ${res.status}` }, { status: 503 });
    }

    const json = await res.json();
    const results: Record<string, unknown>[] = json?.quoteResponse?.result ?? [];

    // Build response keyed by original scanner symbol
    const out: Record<string, { price: number; change: number; changePct: number; name: string }> = {};
    for (const r of results) {
      const yfSym = r.symbol as string;
      const origSymbol = Object.entries(yfMap).find(([, yf]) => yf === yfSym)?.[0] ?? yfSym;
      out[origSymbol] = {
        price: (r.regularMarketPrice as number) ?? 0,
        change: (r.regularMarketChange as number) ?? 0,
        changePct: (r.regularMarketChangePercent as number) ?? 0,
        name: (r.shortName as string) ?? origSymbol,
      };
    }

    return NextResponse.json(out);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
