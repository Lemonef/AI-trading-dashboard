"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ScanButton() {
  const [scanning, setScanning] = useState(false);

  async function scan() {
    setScanning(true);
    const id = toast.loading("Scanning markets…", { duration: Infinity });
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.dismiss(id);
      toast.success("Scan triggered! Reloading in 15s…", { duration: 15000 });
      setTimeout(() => {
        setScanning(false);
        window.location.reload();
      }, 15000);
    } catch {
      toast.dismiss(id);
      toast.error("Scan failed. Check GITHUB_TOKEN in Vercel env vars.");
      setScanning(false);
    }
  }

  return (
    <button
      onClick={scan}
      disabled={scanning}
      className="btn-press flex items-center gap-2 border border-ink bg-ink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <RefreshCw size={13} className={scanning ? "animate-spin" : ""} />
      {scanning ? "Scanning…" : "Scan Now"}
    </button>
  );
}
