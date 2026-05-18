"use client";

import { Plus, Minus, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function WatchlistToggle({
  symbol, exchange, timeframe, inWatchlist,
}: {
  symbol: string; exchange: string; timeframe: string; inWatchlist: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    setSessionId(localStorage.getItem("session_id"));
  }, []);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      if (inWatchlist) {
        const params = new URLSearchParams({ symbol });
        if (sessionId) params.set("session_id", sessionId);
        await fetch(`/api/watchlist?${params}`, { method: "DELETE" });
      } else {
        await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol, exchange, timeframe, ...(sessionId ? { session_id: sessionId } : {}) }),
        });
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={inWatchlist ? "Remove from watchlist" : "Add to watchlist"}
      className={`flex h-7 w-7 shrink-0 items-center justify-center border transition-colors disabled:opacity-40 ${
        inWatchlist ? "border-sell/40 text-sell hover:bg-red-50" : "border-buy/40 text-buy hover:bg-green-50"
      }`}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : inWatchlist ? <Minus size={13} /> : <Plus size={13} />}
    </button>
  );
}
