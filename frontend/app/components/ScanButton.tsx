"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

type State = "idle" | "scanning" | "done" | "error";

export default function ScanButton() {
  const [state, setState] = useState<State>("idle");

  async function scan() {
    setState("scanning");
    try {
      const res = await fetch("/api/scan", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status}`);
      setState("done");
      // Scanner runs async on GitHub Actions — reload after 15s to pick up new data
      setTimeout(() => {
        setState("idle");
        window.location.reload();
      }, 15000);
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2000);
    }
  }

  const label = { idle: "Scan Now", scanning: "Scanning…", done: "Triggered ✓", error: "Failed" }[state];
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
