"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { pollWorkflow } from "../../lib/pollWorkflow";

export default function ScanButton() {
  const [scanning, setScanning] = useState(false);

  async function scan() {
    setScanning(true);
    const tid = toast.loading("Scan starting…", { duration: Infinity });
    try {
      const since = new Date().toISOString();
      const res = await fetch("/api/scan", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      await new Promise((r) => setTimeout(r, 12_000));
      await pollWorkflow("scanner.yml", since, 15_000, (elapsed) => {
        toast.loading(`Scanning… ${Math.round(elapsed / 60)}m`, { id: tid, duration: Infinity });
      });
      toast.success("Scan complete — reloading…", { id: tid, duration: 4000 });
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      toast.error(`Scan failed: ${err instanceof Error ? err.message : "unknown"}`, { id: tid, duration: 6000 });
      setScanning(false);
    }
  }

  return (
    <button
      onClick={scan}
      disabled={scanning}
      className="btn-press flex items-center gap-2 border border-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      style={{ background: "linear-gradient(135deg, #1E2328 0%, #161A1D 100%)" }}
    >
      <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
      {scanning ? "Scanning…" : "Scan Now"}
    </button>
  );
}
