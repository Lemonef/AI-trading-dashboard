"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { pollWorkflow } from "../../lib/pollWorkflow";

export default function SummarizeButton() {
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const tid = toast.loading("AI summaries starting…", { duration: Infinity });
    try {
      const since = new Date().toISOString();
      const res = await fetch("/api/summarize", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      await new Promise((r) => setTimeout(r, 12_000));
      await pollWorkflow("summarize.yml", since, 30_000, (elapsed) => {
        toast.loading(`AI summaries… ${Math.round(elapsed / 60)}m`, { id: tid, duration: Infinity });
      });
      toast.success("Summaries done — reloading…", { id: tid, duration: 4000 });
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      toast.error(`Summarize failed: ${err instanceof Error ? err.message : "unknown"}`, { id: tid, duration: 6000 });
      setRunning(false);
    }
  }

  return (
    <button
      onClick={run}
      disabled={running}
      title="Regenerate all signal summaries using AI IDS-style analysis"
      className="btn-press flex items-center gap-2 border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-400 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Sparkles size={13} className={running ? "animate-pulse text-amber-500" : "text-amber-500"} />
      {running ? "Generating…" : "AI Summary"}
    </button>
  );
}
