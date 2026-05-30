import { NextRequest, NextResponse } from "next/server";

const REPO = "Lemonef/AI-trading-dashboard";

export async function GET(req: NextRequest) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return NextResponse.json({ error: "no token" }, { status: 503 });

  const workflow = req.nextUrl.searchParams.get("workflow");
  const since = req.nextUrl.searchParams.get("since");
  if (!workflow) return NextResponse.json({ error: "missing workflow" }, { status: 400 });

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${workflow}/runs?per_page=5`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      cache: "no-store",
    },
  );

  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 });

  const data = await res.json();
  const runs: { status: string; conclusion: string | null; created_at: string }[] =
    data.workflow_runs ?? [];

  const run = since
    ? runs.find((r) => new Date(r.created_at) >= new Date(since))
    : runs[0];

  if (!run) return NextResponse.json({ status: "pending" });

  return NextResponse.json({
    status: run.status,
    conclusion: run.conclusion,
  });
}
