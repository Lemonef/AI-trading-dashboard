"use client";

import { Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { pollWorkflow } from "../../lib/pollWorkflow";

type Phase = "idle" | "scanning" | "discovering" | "summarizing" | "done" | "error";

const SETTLE_MS = 12_000;

async function dispatch(route: string): Promise<void> {
  const res = await fetch(route, { method: "POST" });
  if (!res.ok) throw new Error(await res.text());
}

export default function RunAllButton() {
  const [phase, setPhase] = useState<Phase>("idle");

  async function runAll() {
    setPhase("scanning");
    const tid = toast.loading("Scan starting…", { duration: Infinity });

    try {
      // Step 1 — Scan
      const scanSince = new Date().toISOString();
      await dispatch("/api/scan");
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      await pollWorkflow("scanner.yml", scanSince, 15_000, (e) =>
        toast.loading(`Scanning… ${Math.round(e / 60)}m`, { id: tid, duration: Infinity }));

      // Step 2 — Discovery
      setPhase("discovering");
      toast.loading("Scan done — running Discovery…", { id: tid, duration: Infinity });
      const discSince = new Date().toISOString();
      await dispatch("/api/discover");
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      await pollWorkflow("discovery.yml", discSince, 10_000, (e) =>
        toast.loading(`Discovery… ${Math.round(e / 60)}m`, { id: tid, duration: Infinity }));

      // Step 3 — AI Summaries
      setPhase("summarizing");
      toast.loading("Discovery done — AI summaries…", { id: tid, duration: Infinity });
      const sumSince = new Date().toISOString();
      await dispatch("/api/summarize");
      await new Promise((r) => setTimeout(r, SETTLE_MS));
      await pollWorkflow("summarize.yml", sumSince, 30_000, (e) =>
        toast.loading(`AI summaries… ${Math.round(e / 60)}m`, { id: tid, duration: Infinity }));

      setPhase("done");
      toast.success("All done — reloading…", { id: tid, duration: 5000 });
      setTimeout(() => window.location.reload(), 4000);
    } catch (err) {
      setPhase("error");
      toast.error(`Failed: ${err instanceof Error ? err.message : "unknown"}`, {
        id: tid,
        duration: 8000,
      });
      setTimeout(() => setPhase("idle"), 8000);
    }
  }

  const labelMap: Record<Phase, string> = {
    idle: "Run All",
    scanning: "Scanning…",
    discovering: "Discovery…",
    summarizing: "AI Summaries…",
    done: "Done!",
    error: "Failed",
  };

  const spinning = phase === "scanning" || phase === "discovering" || phase === "summarizing";

  return (
    <button
      onClick={runAll}
      disabled={phase !== "idle" && phase !== "error"}
      className="btn-press flex items-center gap-2 border border-amber-500 px-4 py-2 text-sm font-semibold text-amber-600 shadow-sm transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      style={{ background: "linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)" }}
    >
      <Zap size={13} className={spinning ? "animate-pulse" : ""} />
      {labelMap[phase]}
    </button>
  );
}
