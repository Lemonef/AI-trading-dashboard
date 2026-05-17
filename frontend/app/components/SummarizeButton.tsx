"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SummarizeButton() {
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const res = await fetch("/api/summarize", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      // GitHub Actions dispatch returns 204 immediately — workflow runs async in background
      toast.success("Gemini triggered — summaries updating in ~30s", {
        duration: 30000,
        description: "Page will reload automatically.",
      });
      setTimeout(() => {
        setRunning(false);
        window.location.reload();
      }, 32000);
    } catch {
      toast.error("Failed to trigger Gemini. Check GITHUB_TOKEN in Vercel env vars.");
      setRunning(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={running}
      title="Regenerate all signal summaries using Gemini IDS-style analysis"
      className="flex items-center gap-2 border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-400 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Sparkles size={13} className={running ? "animate-pulse text-amber-500" : "text-amber-500"} />
      {running ? "Generating…" : "AI Summary"}
    </button>
  );
}
