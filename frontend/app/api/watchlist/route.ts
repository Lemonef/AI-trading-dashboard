import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL, supabaseHeaders } from "../../../lib/supabase";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const url = new URL(`${SUPABASE_URL}/rest/v1/watchlist`);
  url.searchParams.set("select", "symbol");
  if (sessionId) url.searchParams.set("session_id", `eq.${sessionId}`);
  const res = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
  if (!res.ok) return NextResponse.json([]);
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/watchlist?on_conflict=symbol,session_id`, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!symbol) return NextResponse.json({ error: "missing symbol" }, { status: 400 });
  const url = new URL(`${SUPABASE_URL}/rest/v1/watchlist`);
  url.searchParams.set("symbol", `eq.${symbol}`);
  if (sessionId) url.searchParams.set("session_id", `eq.${sessionId}`);
  await fetch(url, { method: "DELETE", headers: supabaseHeaders() });
  return NextResponse.json({ ok: true });
}
