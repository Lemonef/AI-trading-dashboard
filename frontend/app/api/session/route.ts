import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function headers() {
  return { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, "Content-Type": "application/json" };
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json(null);
  const url = new URL(`${SUPABASE_URL}/rest/v1/user_sessions`);
  url.searchParams.set("id", `eq.${id}`);
  url.searchParams.set("select", "*");
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) return NextResponse.json(null);
  const rows = await res.json();
  return NextResponse.json(rows[0] ?? null);
}

export async function POST(req: NextRequest) {
  const body = await req.json(); // { id, name, telegram_chat_id }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_sessions`, {
    method: "POST",
    headers: { ...headers(), Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  const rows = await res.json();
  return NextResponse.json(rows[0] ?? null);
}
