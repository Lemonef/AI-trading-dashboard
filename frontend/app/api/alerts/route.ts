import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function headers() {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol");
  const sessionId = req.nextUrl.searchParams.get("session_id");
  const url = new URL(`${SUPABASE_URL}/rest/v1/price_alerts`);
  url.searchParams.set("select", "*");
  url.searchParams.set("order", "created_at.desc");
  if (symbol) url.searchParams.set("symbol", `eq.${symbol}`);
  if (sessionId) url.searchParams.set("session_id", `eq.${sessionId}`);

  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) return NextResponse.json([], { status: 200 });
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.entry && !body.tp && !body.sl) {
    return NextResponse.json({ error: "At least one level (entry, tp, sl) required" }, { status: 400 });
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/price_alerts`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify({ ...body, active: true }),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  const rows = await res.json();
  return NextResponse.json(rows[0] ?? null);
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const url = new URL(`${SUPABASE_URL}/rest/v1/price_alerts`);
  url.searchParams.set("id", `eq.${id}`);
  await fetch(url, { method: "DELETE", headers: headers() });
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const body = await req.json();
  const url = new URL(`${SUPABASE_URL}/rest/v1/price_alerts`);
  url.searchParams.set("id", `eq.${id}`);
  await fetch(url, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return NextResponse.json({ ok: true });
}
