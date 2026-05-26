"use client";

import { Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function DiscoverButton() {
  const [running, setRunning] = useState(false);

  async function discover() {
    setRunning(true);
    const id = toast.loading("Running discovery scan…", { duration: Infinity });
    try {
      const res = await fetch("/api/discover", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.dismiss(id);
      toast.success("Discovery triggered! market_scores will update in ~2min.");
    } catch {
      toast.dismiss(id);
      toast.error("Discovery failed. Check GITHUB_TOKEN in Vercel env vars.");
    } finally {
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
      {running ? "Running…" : "Discover"}
    </button>
  );
}
