import { NextResponse } from "next/server";

export async function POST() {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_TOKEN not configured in Vercel env vars" },
      { status: 503 },
    );
  }

  const res = await fetch(
    "https://api.github.com/repos/Lemonef/AI-trading-dashboard/actions/workflows/scanner.yml/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: "main" }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
