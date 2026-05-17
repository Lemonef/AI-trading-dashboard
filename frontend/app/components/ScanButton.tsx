"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

type State = "idle" | "scanning" | "done" | "error";

export default function ScanButton() {
  const [state, setState] = useState<State>("idle");

  async function scan() {
    setState("scanning");
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) throw new Error("NEXT_PUBLIC_API_URL not set");
      const res = await fetch(`${apiUrl}/api/scan`, { method: "POST" });
      if (!res.ok) throw new Error(`Scan failed: ${res.status}`);
      setState("done");
      setTimeout(() => {
        setState("idle");
        window.location.reload();
      }, 1400);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const label = { idle: "Scan Now", scanning: "Scanning…", done: "Done ✓", error: "Failed" }[state];
  const disabled = state === "scanning";

  return (
    <button
      onClick={scan}
      disabled={disabled}
      className="flex items-center gap-2 border border-ink bg-ink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-75 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <RefreshCw size={13} className={state === "scanning" ? "animate-spin" : ""} />
      {label}
    </button>
  );
}
