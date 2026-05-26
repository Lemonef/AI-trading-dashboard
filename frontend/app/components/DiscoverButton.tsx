"use client";

import { Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function DiscoverButton() {
  const [running, setRunning] = useState(false);

  async function discover() {
    setRunning(true);
    const id = toast.loading("Scoring markets…", { duration: Infinity });
    try {
      const res = await fetch("/api/discover", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.dismiss(id);
      toast.success("Discovery triggered! Results ready in ~30s.");
    } catch {
      toast.dismiss(id);
      toast.error("Discovery failed. Is the backend running?");
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
      {running ? "Scoring…" : "Discover"}
    </button>
  );
}
