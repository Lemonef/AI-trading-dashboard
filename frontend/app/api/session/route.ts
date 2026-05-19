import { NextRequest, NextResponse } from "next/server";
import { SUPABASE_URL, supabaseHeaders } from "../../../lib/supabase";

// Service role key bypasses RLS — safe here (server-only route)
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
function adminHeaders() {
  const key = SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

async function siblingName(telegramChatId: string): Promise<string | null> {
  const url = new URL(`${SUPABASE_URL}/rest/v1/user_sessions`);
  url.searchParams.set("telegram_chat_id", `eq.${telegramChatId}`);
  url.searchParams.set("name", "not.is.null");
  url.searchParams.set("select", "name");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, { headers: adminHeaders(), cache: "no-store" });
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.name ?? null;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const tgId = req.nextUrl.searchParams.get("telegram_chat_id");

  // Lookup by telegram_chat_id — returns first named session for that Telegram user
  if (!id && tgId) {
    const name = await siblingName(tgId);
    return NextResponse.json(name ? { name } : null);
  }

  if (!id) return NextResponse.json(null);

  const url = new URL(`${SUPABASE_URL}/rest/v1/user_sessions`);
  url.searchParams.set("id", `eq.${id}`);
  url.searchParams.set("select", "*");
  const res = await fetch(url, { headers: supabaseHeaders(), cache: "no-store" });
  if (!res.ok) return NextResponse.json(null);
  const rows = await res.json();
  const session = rows[0] ?? null;

  // Inherit name from sibling if missing
  if (session && !session.name && session.telegram_chat_id) {
    const name = await siblingName(session.telegram_chat_id);
    if (name) session.name = name;
  }

  return NextResponse.json(session);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Inherit name from existing linked session when linking telegram_chat_id
  if (body.telegram_chat_id && !body.name) {
    const name = await siblingName(body.telegram_chat_id);
    if (name) body.name = name;
  }

  const res = await fetch(`${SUPABASE_URL}/rest/v1/user_sessions`, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });
  const rows = await res.json();
  return NextResponse.json(rows[0] ?? null);
}
