import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL, supabaseHeaders } from "../../../lib/supabase";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json(null);
  const url = new URL(`${SUPABASE_URL}/rest/v1/user_sessions`);
  url.searchParams.set("id", `eq.${id}`);
  url.searchParams.set("select", "*");
  const res = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
  if (!res.ok) return NextResponse.json(null);
  const rows = await res.json();
  return NextResponse.json(rows[0] ?? null);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_sessions`, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  const rows = await res.json();
  return NextResponse.json(rows[0] ?? null);
}
