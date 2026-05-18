"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Trash2, Save, X } from "lucide-react";
import type { PriceAlert } from "../../lib/api";

type Form = { entry: string; tp: string; sl: string; note: string };

export default function AlertPanel({ symbol, currentPrice, onClose }: {
  symbol: string;
  currentPrice?: number;
  onClose: () => void;
}) {
  const [alert, setAlert] = useState<PriceAlert | null>(null);
  const [form, setForm] = useState<Form>({ entry: "", tp: "", sl: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/alerts?symbol=${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((rows: PriceAlert[]) => {
        const active = rows.find((r) => r.active) ?? null;
        setAlert(active);
        if (active) {
          setForm({
            entry: active.entry?.toString() ?? "",
            tp: active.tp?.toString() ?? "",
            sl: active.sl?.toString() ?? "",
            note: active.note ?? "",
          });
        } else if (currentPrice) {
          setForm((f) => ({ ...f, entry: currentPrice.toFixed(4) }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [symbol, currentPrice]);

  async function save() {
    setSaving(true);
    try {
      if (alert) {
        // Update existing
        await fetch(`/api/alerts?id=${alert.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entry: form.entry ? parseFloat(form.entry) : null,
            tp: form.tp ? parseFloat(form.tp) : null,
            sl: form.sl ? parseFloat(form.sl) : null,
            note: form.note || null,
            active: true,
            triggered_at: null,
          }),
        });
      } else {
        // Create new
        await fetch("/api/alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            symbol,
            entry: form.entry ? parseFloat(form.entry) : null,
            tp: form.tp ? parseFloat(form.tp) : null,
            sl: form.sl ? parseFloat(form.sl) : null,
            note: form.note || null,
          }),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!alert) return;
    await fetch(`/api/alerts?id=${alert.id}`, { method: "DELETE" });
    onClose();
  }

  return (
    <div className="border border-line bg-white shadow-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Bell size={13} className="text-amber-500" />
          <span className="text-xs font-semibold text-ink">Price Alert · {symbol}</span>
          {alert && (
            <span className="rounded bg-green-50 border border-green-200 px-1.5 py-px text-[10px] font-semibold text-buy">Active</span>
          )}
        </div>
        <button onClick={onClose} className="text-zinc-400 hover:text-ink"><X size={14} /></button>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-center text-xs text-zinc-400">Loading…</div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          {currentPrice && (
            <p className="text-xs text-zinc-400">Current price: <span className="font-semibold text-ink tabular-nums">{currentPrice.toLocaleString("en-US", { maximumFractionDigits: 4 })}</span></p>
          )}

          {/* Form fields */}
          {[
            { key: "entry", label: "Entry zone", placeholder: "Alert when price reaches this", color: "text-ink" },
            { key: "tp", label: "Take Profit (TP)", placeholder: "Alert when price hits TP", color: "text-buy" },
            { key: "sl", label: "Stop Loss (SL)", placeholder: "Alert when price drops to SL", color: "text-sell" },
          ].map(({ key, label, placeholder, color }) => (
            <div key={key}>
              <label className={`text-[10px] font-semibold uppercase tracking-wide ${color} opacity-70`}>{label}</label>
              <input
                type="number"
                step="any"
                value={form[key as keyof Form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                className="mt-1 w-full rounded border border-line bg-panel px-3 py-1.5 text-sm tabular-nums outline-none focus:border-zinc-400"
              />
            </div>
          ))}

          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Note (optional)</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="e.g. breakout confirmation needed"
              className="mt-1 w-full rounded border border-line bg-panel px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
            />
          </div>

          {alert?.triggered_at && (
            <p className="text-[10px] text-zinc-400">
              Last triggered: {new Date(alert.triggered_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || (!form.entry && !form.tp && !form.sl)}
              className="flex flex-1 items-center justify-center gap-1.5 border border-ink bg-ink py-2 text-xs font-semibold text-white transition-opacity hover:opacity-75 disabled:opacity-40"
            >
              <Save size={12} />
              {saving ? "Saving…" : alert ? "Update Alert" : "Set Alert"}
            </button>
            {alert && (
              <button
                onClick={remove}
                className="flex items-center gap-1.5 border border-sell px-3 py-2 text-xs font-semibold text-sell hover:bg-red-50"
              >
                <Trash2 size={12} />
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
