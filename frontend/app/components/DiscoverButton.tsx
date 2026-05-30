"use client";

import { Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { pollWorkflow } from "../../lib/pollWorkflow";

export default function DiscoverButton() {
  const [running, setRunning] = useState(false);

  async function discover() {
    setRunning(true);
    const tid = toast.loading("Discovery starting…", { duration: Infinity });
    try {
      const since = new Date().toISOString();
      const res = await fetch("/api/discover", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      await new Promise((r) => setTimeout(r, 12_000));
      await pollWorkflow("discovery.yml", since, 15_000, (elapsed) => {
        toast.loading(`Discovery… ${Math.round(elapsed / 60)}m`, { id: tid, duration: Infinity });
      });
      toast.success("Discovery complete — reloading…", { id: tid, duration: 4000 });
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      toast.error(`Discovery failed: ${err instanceof Error ? err.message : "unknown"}`, { id: tid, duration: 6000 });
      setRunning(false);
    }
  }

  return (
    <button
      onClick={discover}
      disabled={running}
      className="btn-press flex items-center gap-2 border border-line bg-white px-4 py-2 text-sm font-semibold text-ink shadow-sm transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Zap size={13} className={running ? "animate-pulse" : ""} />
      {running ? "Discovering…" : "Discover"}
    </button>
  );
}
