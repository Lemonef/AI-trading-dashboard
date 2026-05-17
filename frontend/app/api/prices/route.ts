import { NextRequest, NextResponse } from "next/server";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function toYFSymbol(symbol: string): string {
  if (symbol.includes("/")) return `${symbol.split("/")[0]}-USD`;
  return symbol;
}

async function fetchOne(origSymbol: string): Promise<{ symbol: string; price: number; change: number; changePct: number; name: string } | null> {
  const yfSym = toYFSymbol(origSymbol);
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yfSym)}?interval=1d&range=2d&includePrePost=false`,
      { headers: { "User-Agent": UA, Accept: "application/json" }, next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) return null;

    const price: number = meta.regularMarketPrice;
    const prev: number = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prev;
    const changePct = prev ? (change / prev) * 100 : 0;
    const name: string = meta.longName ?? meta.shortName ?? origSymbol;

    return { symbol: origSymbol, price, change, changePct, name };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("symbols") ?? "";
  const symbols = raw.split(",").filter(Boolean);
  if (!symbols.length) return NextResponse.json({});

  const results = await Promise.allSettled(symbols.map(fetchOne));

  const out: Record<string, { price: number; change: number; changePct: number; name: string }> = {};
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) {
      const { symbol, ...data } = r.value;
      out[symbol] = data;
    }
  }

  return NextResponse.json(out);
}
