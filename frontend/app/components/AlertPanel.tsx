"use client";

import { useState, useEffect } from "react";
import { Bell, Trash2, Save, X, Plus, CheckCircle } from "lucide-react";
import type { PriceAlert } from "../../lib/api";

type Form = { entry: string; tp: string; sl: string; note: string };
const EMPTY_FORM: Form = { entry: "", tp: "", sl: "", note: "" };

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

export default function AlertPanel({
  symbol,
  currentPrice,
  onClose,
}: {
  symbol: string;
  currentPrice?: number;
  onClose: () => void;
}) {
  const [allAlerts, setAllAlerts] = useState<PriceAlert[]>([]);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const sid = localStorage.getItem("session_id");
    setSessionId(sid);
    loadAlerts(sid);
  }, []);

  async function loadAlerts(sid: string | null) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sid) params.set("session_id", sid);
      const res = await fetch(`/api/alerts?${params}`);
      const rows: PriceAlert[] = await res.json();
      setAllAlerts(rows);
    } finally {
      setLoading(false);
    }
  }

  const isBlank = !form.entry && !form.tp && !form.sl;

  async function save() {
    if (isBlank) return;
    setSaving(true);
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          entry: form.entry ? parseFloat(form.entry) : null,
          tp: form.tp ? parseFloat(form.tp) : null,
          sl: form.sl ? parseFloat(form.sl) : null,
          note: form.note || null,
          ...(sessionId ? { session_id: sessionId } : {}),
        }),
      });
      setForm(EMPTY_FORM);
      setAdding(false);
      await loadAlerts(sessionId);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    setAllAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="border border-line bg-white shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-amber-500" />
          <span className="text-xs font-semibold text-ink">Price Alerts</span>
          {allAlerts.length > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">
              {allAlerts.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-ink"><X size={14} /></button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-6 text-center text-xs text-zinc-400">Loading…</div>
        ) : (
          <>
            {/* All alerts list */}
            {allAlerts.length > 0 && (
              <div className="divide-y divide-line">
                {allAlerts.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 px-4 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-ink">{a.symbol}</span>
                        {a.triggered_at && (
                          <span title="Triggered"><CheckCircle size={11} className="text-buy" /></span>
                        )}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-zinc-500">
                        {a.entry != null && <span>Entry {fmt(a.entry)}</span>}
                        {a.tp != null && <span className="text-buy">TP {fmt(a.tp)}</span>}
                        {a.sl != null && <span className="text-sell">SL {fmt(a.sl)}</span>}
                        {a.note && <span className="text-zinc-400 italic">{a.note}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => remove(a.id)}
                      className="mt-0.5 shrink-0 text-zinc-300 hover:text-sell"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {allAlerts.length === 0 && !adding && (
              <div className="px-4 py-5 text-center text-xs text-zinc-400">No active alerts</div>
            )}

            {/* Add form */}
            {adding && (
              <div className="border-t border-line px-4 py-3 space-y-2.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  New alert · {symbol}
                  {currentPrice && <span className="ml-1 text-zinc-300">(now {fmt(currentPrice)})</span>}
                </div>
                {[
                  { key: "entry", label: "Entry ≤", placeholder: "Alert when price drops to this", color: "text-ink" },
                  { key: "tp", label: "TP ≥", placeholder: "Alert when price hits take profit", color: "text-buy" },
                  { key: "sl", label: "SL ≤", placeholder: "Alert when price hits stop loss", color: "text-sell" },
                ].map(({ key, label, placeholder, color }) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className={`w-12 shrink-0 text-[10px] font-semibold ${color}`}>{label}</span>
                    <input
                      type="number"
                      step="any"
                      value={form[key as keyof Form]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="flex-1 rounded border border-line bg-panel px-2 py-1 text-xs tabular-nums outline-none focus:border-zinc-400"
                    />
                  </div>
                ))}
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="Note (optional)"
                  className="w-full rounded border border-line bg-panel px-2 py-1 text-xs outline-none focus:border-zinc-400"
                />
                {isBlank && (
                  <p className="text-[10px] text-sell">Set at least one level (Entry, TP, or SL)</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={save}
                    disabled={saving || isBlank}
                    className="flex flex-1 items-center justify-center gap-1.5 border border-ink bg-ink py-1.5 text-xs font-semibold text-white hover:opacity-75 disabled:opacity-40"
                  >
                    <Save size={11} />{saving ? "Saving…" : "Save Alert"}
                  </button>
                  <button
                    onClick={() => { setAdding(false); setForm(EMPTY_FORM); }}
                    className="border border-line px-3 py-1.5 text-xs text-zinc-500 hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer — Add new alert for this symbol */}
      {!adding && (
        <div className="border-t border-line px-4 py-2.5">
          <button
            onClick={() => {
              setAdding(true);
              if (currentPrice) setForm((f) => ({ ...f, entry: currentPrice.toFixed(4) }));
            }}
            className="flex w-full items-center justify-center gap-1.5 border border-dashed border-zinc-300 py-1.5 text-xs text-zinc-500 hover:border-zinc-400 hover:text-ink"
          >
            <Plus size={12} />Add alert for {symbol}
          </button>
        </div>
      )}
    </div>
  );
}
