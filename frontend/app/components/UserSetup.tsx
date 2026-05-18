"use client";

import { useState, useEffect } from "react";
import { User, Bell, Check } from "lucide-react";

type Session = { id: string; name: string | null; telegram_chat_id: string | null };

function genUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useSession(): { sessionId: string | null; session: Session | null } {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let id = localStorage.getItem("session_id");
    if (!id) {
      id = genUUID();
      localStorage.setItem("session_id", id);
    }
    // Also set cookie so server components can read it
    document.cookie = `session_id=${id}; path=/; max-age=31536000; SameSite=Lax`;
    setSessionId(id);
    fetch(`/api/session?id=${id}`)
      .then((r) => r.json())
      .then((s) => setSession(s))
      .catch(() => {});
  }, []);

  return { sessionId, session };
}

export default function UserSetup() {
  const { sessionId, session } = useSession();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [chatId, setChatId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (session) {
      setName(session.name ?? "");
      setChatId(session.telegram_chat_id ?? "");
    }
  }, [session]);

  async function save() {
    if (!sessionId) return;
    setSaving(true);
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId, name: name || null, telegram_chat_id: chatId || null }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => { setSaved(false); setOpen(false); }, 1200);
  }

  if (!sessionId) return null;

  const hasSetup = session?.telegram_chat_id;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 border px-3 py-1.5 text-xs font-semibold transition-colors ${
          hasSetup
            ? "border-buy/30 bg-green-50 text-buy"
            : "border-amber-300 bg-amber-50 text-amber-700"
        }`}
        title="User settings"
      >
        <User size={12} />
        {hasSetup ? (session?.name ?? "You") : "Setup alerts"}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 border border-line bg-white shadow-lg">
          <div className="border-b border-line bg-panel px-4 py-2.5 text-xs font-semibold text-zinc-500">
            Your Profile · ID {sessionId.slice(0, 8)}…
          </div>
          <div className="px-4 py-4 space-y-3">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="mt-1 w-full rounded border border-line bg-panel px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Telegram Chat ID
              </label>
              <input
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 123456789"
                className="mt-1 w-full rounded border border-line bg-panel px-3 py-1.5 text-sm tabular-nums outline-none focus:border-zinc-400"
              />
              <div className="mt-1.5 space-y-0.5 text-[10px] text-zinc-500 bg-zinc-50 border border-zinc-200 rounded px-2.5 py-2">
                <p className="font-semibold text-zinc-600">How to get your ID:</p>
                <p>1. Open Telegram → search <strong>@Lemontradeaibot</strong></p>
                <p>2. Tap <strong>Start</strong> then send <strong>/myid</strong></p>
                <p>3. Bot replies with your number → paste it above</p>
              </div>
            </div>
            <button
              onClick={save}
              disabled={saving || (!name && !chatId)}
              className="flex w-full items-center justify-center gap-1.5 border border-ink bg-ink py-2 text-xs font-semibold text-white hover:opacity-75 disabled:opacity-40"
            >
              {saved ? <><Check size={12} /> Saved</> : saving ? "Saving…" : <><Bell size={12} /> Save</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
