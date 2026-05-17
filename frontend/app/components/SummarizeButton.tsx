"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

type State = "idle" | "running" | "done" | "error";

export default function SummarizeButton() {
  const [state, setState] = useState<State>("idle");

  async function run() {
    setState("running");
    try {
      const res = await fetch("/api/summarize", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      setState("done");
      setTimeout(() => {
        setState("idle");
        window.location.reload();
      }, 20000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  const label = {
    idle: "Gemini Summaries",
    running: "Generating…",
    done: "Done ✓ (reloading)",
    error: "Failed",
  }[state];

  return (
    <button
      onClick={run}
      disabled={state === "running"}
      title="Regenerate all signal summaries using Gemini IDS-style analysis"
      className="flex items-center gap-2 border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-400 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Sparkles size={13} className={state === "running" ? "animate-pulse text-amber-500" : "text-amber-500"} />
      {label}
    </button>
  );
}
