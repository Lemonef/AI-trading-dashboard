import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export async function GET() {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/signals`);
    url.searchParams.set("select", "symbol,close,exchange,timeframe");
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "200");

    const res = await fetch(url, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      cache: "no-store",
    });
    if (!res.ok) return NextResponse.json([]);

    const rows: { symbol: string; close: number; exchange: string; timeframe: string }[] = await res.json();
    // Deduplicate by symbol
    const seen = new Set<string>();
    const unique = rows.filter((r) => {
      if (seen.has(r.symbol)) return false;
      seen.add(r.symbol);
      return true;
    });
    return NextResponse.json(unique);
  } catch {
    return NextResponse.json([]);
  }
}
