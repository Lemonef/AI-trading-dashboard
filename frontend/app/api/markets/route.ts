import { NextResponse } from "next/server";

function supabaseHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const res = await fetch(
      `${url}/rest/v1/market_scores?select=*&order=score.desc&limit=100`,
      { headers: supabaseHeaders(), next: { revalidate: 120 } }
    );
    if (!res.ok) return NextResponse.json([], { status: 200 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
