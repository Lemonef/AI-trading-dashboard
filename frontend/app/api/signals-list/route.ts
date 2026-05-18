import { NextResponse } from "next/server";
import { SUPABASE_URL, supabaseHeaders } from "../../../lib/supabase";

export async function GET() {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/signals`);
    url.searchParams.set("select", "symbol,close,exchange,timeframe");
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", "200");

    const res = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
    if (!res.ok) return NextResponse.json([]);

    const rows: { symbol: string; close: number; exchange: string; timeframe: string }[] = await res.json();
    const seen = new Set<string>();
    return NextResponse.json(rows.filter((r) => seen.has(r.symbol) ? false : (seen.add(r.symbol), true)));
  } catch {
    return NextResponse.json([]);
  }
}
