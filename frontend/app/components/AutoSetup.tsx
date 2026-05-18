"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

export default function AutoSetup() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const telegramId = searchParams.get("setup");
    if (!telegramId) return;

    async function doSetup() {
      let sessionId = localStorage.getItem("session_id");
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("session_id", sessionId);
        document.cookie = `session_id=${sessionId}; path=/; max-age=31536000; SameSite=Lax`;
      }

      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId, telegram_chat_id: telegramId }),
      });

      toast.success(`Telegram connected! ✓`, { duration: 3000 });
      // Full reload so UserSetup reflects new session
      setTimeout(() => { window.location.href = "/"; }, 1000);
    }

    doSetup();
  }, []);

  return null;
}
