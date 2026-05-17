"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function SummarizeButton() {
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    const id = toast.loading("Gemini is summarizing all signals…", { duration: Infinity });
    try {
      const res = await fetch("/api/summarize", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.dismiss(id);
      toast.success("Gemini finished! Reloading in 20s…", { duration: 20000 });
      setTimeout(() => {
        setRunning(false);
        window.location.reload();
      }, 20000);
    } catch {
      toast.dismiss(id);
      toast.error("Gemini summary failed. Check GitHub Actions logs.");
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
      {running ? "Generating…" : "Gemini Summaries"}
    </button>
  );
}
