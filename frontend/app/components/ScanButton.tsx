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
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/scan?manual=true`, { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      toast.dismiss(id);
      toast.success("Scan complete! Reloading in 5s…", { duration: 5000 });
      setTimeout(() => {
        setScanning(false);
        window.location.reload();
      }, 5000);
    } catch {
      toast.dismiss(id);
      toast.error("Scan failed. Is the backend running?");
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
