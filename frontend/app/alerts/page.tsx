"use client";

import { useState, useEffect, useMemo } from "react";
import { Bell, Plus, Trash2, Pencil, Save, X, CheckCircle, Search } from "lucide-react";
import type { PriceAlert } from "../../lib/api";

type Form = { entry: string; tp: string; sl: string; note: string };
const EMPTY: Form = { entry: "", tp: "", sl: "", note: "" };

function fmt(v: number | null | undefined) {
  if (v == null) return "—";
  return v.toLocaleString("en-US", { maximumFractionDigits: 6 });
}

type Signal = { symbol: string; close: number; exchange: string; timeframe: string };

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Search for adding new alert
  const [search, setSearch] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState<Signal | null>(null);
  const [addForm, setAddForm] = useState<Form>(EMPTY);
  const [adding, setAdding] = useState(false);

  // Edit existing
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const sid = localStorage.getItem("session_id");
    setSessionId(sid);
    Promise.all([loadAlerts(sid), loadSignals()]).finally(() => setLoading(false));
  }, []);

  async function loadAlerts(sid: string | null) {
    const params = new URLSearchParams();
    if (sid) params.set("session_id", sid);
    const res = await fetch(`/api/alerts?${params}`);
    if (res.ok) setAlerts(await res.json());
  }

  async function loadSignals() {
    const res = await fetch("/api/signals-list");
    if (res.ok) setSignals(await res.json());
  }

  const filteredSignals = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return signals.filter((s) =>
      s.symbol.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [signals, search]);

  async function saveAlert() {
    if (!addForm.entry && !addForm.tp && !addForm.sl) return;
    if (!selectedSymbol) return;
    setSaving(true);
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selectedSymbol.symbol,
          entry: addForm.entry ? parseFloat(addForm.entry) : null,
          tp: addForm.tp ? parseFloat(addForm.tp) : null,
          sl: addForm.sl ? parseFloat(addForm.sl) : null,
          note: addForm.note || null,
          ...(sessionId ? { session_id: sessionId } : {}),
        }),
      });
      setAdding(false);
      setSelectedSymbol(null);
      setSearch("");
      setAddForm(EMPTY);
      await loadAlerts(sessionId);
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editId || (!editForm.entry && !editForm.tp && !editForm.sl)) return;
    setSaving(true);
    try {
      await fetch(`/api/alerts?id=${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entry: editForm.entry ? parseFloat(editForm.entry) : null,
          tp: editForm.tp ? parseFloat(editForm.tp) : null,
          sl: editForm.sl ? parseFloat(editForm.sl) : null,
          note: editForm.note || null,
          active: true,
          triggered_at: null,
        }),
      });
      setEditId(null);
      await loadAlerts(sessionId);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  const active = alerts.filter((a) => a.active && !a.triggered_at);
  const triggered = alerts.filter((a) => a.triggered_at);

  return (
    <main className="min-h-screen">
      <section className="border-b border-line bg-[#F7F6F0]">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5">
          <div>
            <p className="text-xs text-zinc-400">{active.length} active · {triggered.length} triggered</p>
          </div>
          <button
            onClick={() => { setAdding(true); setSearch(""); setSelectedSymbol(null); setAddForm(EMPTY); }}
            className="flex items-center gap-2 border border-ink bg-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-75"
          >
            <Plus size={13} />New Alert
          </button>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-5 py-6 space-y-5">

        {/* Add new alert panel */}
        {adding && (
          <div className="animate-slidedown border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line bg-panel px-5 py-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500">
                <Bell size={13} className="text-amber-500" />
                New Price Alert
              </div>
              <button onClick={() => setAdding(false)}><X size={14} className="text-zinc-400 hover:text-ink" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Symbol search */}
              {!selectedSymbol ? (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Search Market</label>
                  <div className="relative mt-1">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      autoFocus
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Type to search — AAPL, Gold, EUR, BTC…"
                      className="w-full rounded border border-line bg-panel pl-8 pr-3 py-2 text-sm outline-none focus:border-zinc-400"
                    />
                  </div>
                  {filteredSignals.length > 0 && (
                    <div className="mt-1 border border-line bg-white shadow-sm">
                      {filteredSignals.map((s) => (
                        <button
                          key={s.symbol}
                          onClick={() => { setSelectedSymbol(s); setSearch(s.symbol); }}
                          className="flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-panel border-b border-line last:border-0"
                        >
                          <span className="font-semibold text-ink">{s.symbol}</span>
                          <span className="text-xs text-zinc-400 tabular-nums">{fmt(s.close)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {search && filteredSignals.length === 0 && (
                    <p className="mt-2 text-xs text-zinc-400">No markets found for "{search}"</p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-ink">{selectedSymbol.symbol}</span>
                    <span className="ml-2 text-xs text-zinc-400 tabular-nums">Current: {fmt(selectedSymbol.close)}</span>
                  </div>
                  <button onClick={() => { setSelectedSymbol(null); setSearch(""); }} className="text-xs text-zinc-400 hover:text-ink">Change</button>
                </div>
              )}

              {/* Level inputs */}
              {selectedSymbol && (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "entry", label: "Entry ≤", color: "text-ink" },
                      { key: "tp", label: "TP ≥", color: "text-buy" },
                      { key: "sl", label: "SL ≤", color: "text-sell" },
                    ].map(({ key, label, color }) => (
                      <div key={key}>
                        <label className={`text-[10px] font-semibold ${color}`}>{label}</label>
                        <input
                          type="number" step="any"
                          value={addForm[key as keyof Form]}
                          onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder="—"
                          className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 text-sm tabular-nums outline-none focus:border-zinc-400"
                        />
                      </div>
                    ))}
                  </div>
                  <input
                    type="text" value={addForm.note}
                    onChange={(e) => setAddForm((f) => ({ ...f, note: e.target.value }))}
                    placeholder="Note (optional)"
                    className="w-full rounded border border-line bg-panel px-3 py-1.5 text-sm outline-none focus:border-zinc-400"
                  />
                  {!addForm.entry && !addForm.tp && !addForm.sl && (
                    <p className="text-xs text-sell">Set at least one level</p>
                  )}
                  <button
                    onClick={saveAlert}
                    disabled={saving || (!addForm.entry && !addForm.tp && !addForm.sl)}
                    className="flex w-full items-center justify-center gap-2 border border-ink bg-ink py-2 text-sm font-semibold text-white hover:opacity-75 disabled:opacity-40"
                  >
                    <Bell size={13} />{saving ? "Saving…" : "Set Alert"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Active alerts */}
        {loading ? (
          <div className="py-10 text-center text-sm text-zinc-400">Loading…</div>
        ) : active.length === 0 && !adding ? (
          <div className="border border-line bg-white px-6 py-14 text-center">
            <Bell size={24} className="mx-auto mb-3 text-zinc-300" />
            <p className="text-sm font-semibold text-ink">No active alerts</p>
            <p className="mt-1 text-sm text-zinc-500">Set price alerts on any market — get notified on Telegram when price hits your level.</p>
            <button
              onClick={() => { setAdding(true); setSearch(""); setSelectedSymbol(null); setAddForm(EMPTY); }}
              className="mt-4 group mx-auto flex items-center gap-1.5 text-sm font-semibold text-ink transition-colors hover:text-zinc-500"
            >
              <Plus size={14} className="transition-transform group-hover:rotate-90 duration-200" />
              <span className="underline underline-offset-2 decoration-zinc-300 group-hover:decoration-zinc-500 transition-colors">Add first alert</span>
            </button>
          </div>
        ) : active.length > 0 && (
          <div className="border border-line bg-white">
            <div className="border-b border-line bg-panel px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Active — {active.length}
            </div>
            <div className="divide-y divide-line">
              {active.map((a) => (
                <div key={a.id}>
                  <div className="flex items-start gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-ink">{a.symbol}</span>
                      <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-zinc-500">
                        {a.entry != null && <span>Entry ≤ <span className="font-medium text-ink">{fmt(a.entry)}</span></span>}
                        {a.tp != null && <span>TP ≥ <span className="font-medium text-buy">{fmt(a.tp)}</span></span>}
                        {a.sl != null && <span>SL ≤ <span className="font-medium text-sell">{fmt(a.sl)}</span></span>}
                        {a.note && <span className="italic text-zinc-400">{a.note}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => { setEditId(a.id); setEditForm({ entry: a.entry?.toString() ?? "", tp: a.tp?.toString() ?? "", sl: a.sl?.toString() ?? "", note: a.note ?? "" }); }} className="text-zinc-300 hover:text-ink"><Pencil size={13} /></button>
                      <button onClick={() => remove(a.id)} className="text-zinc-300 hover:text-sell"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  {editId === a.id && (
                    <div className="border-t border-line bg-panel px-5 py-3 space-y-2">
                      <div className="grid grid-cols-3 gap-2">
                        {[{ key: "entry", label: "Entry ≤", color: "text-ink" }, { key: "tp", label: "TP ≥", color: "text-buy" }, { key: "sl", label: "SL ≤", color: "text-sell" }].map(({ key, label, color }) => (
                          <div key={key}>
                            <label className={`text-[10px] font-semibold ${color}`}>{label}</label>
                            <input type="number" step="any" value={editForm[key as keyof Form]} onChange={(e) => setEditForm((f) => ({ ...f, [key]: e.target.value }))} className="mt-1 w-full rounded border border-line bg-white px-2 py-1 text-xs outline-none focus:border-zinc-400" />
                          </div>
                        ))}
                      </div>
                      <input type="text" value={editForm.note} onChange={(e) => setEditForm((f) => ({ ...f, note: e.target.value }))} placeholder="Note" className="w-full rounded border border-line bg-white px-2 py-1 text-xs outline-none" />
                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={saving} className="flex flex-1 items-center justify-center gap-1 border border-ink bg-ink py-1.5 text-xs font-semibold text-white hover:opacity-75 disabled:opacity-40"><Save size={11} />Save</button>
                        <button onClick={() => setEditId(null)} className="border border-line px-3 py-1.5 text-xs text-zinc-500 hover:text-ink">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Triggered alerts */}
        {triggered.length > 0 && (
          <div className="border border-line bg-white">
            <div className="border-b border-line bg-panel px-5 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Triggered — {triggered.length}
            </div>
            <div className="divide-y divide-line">
              {triggered.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3 opacity-60">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-ink">{a.symbol}</span>
                      <CheckCircle size={12} className="text-buy" />
                      {a.triggered_at && <span className="text-[10px] text-zinc-400">{new Date(a.triggered_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-zinc-500">
                      {a.entry != null && <span>Entry {fmt(a.entry)}</span>}
                      {a.tp != null && <span className="text-buy">TP {fmt(a.tp)}</span>}
                      {a.sl != null && <span className="text-sell">SL {fmt(a.sl)}</span>}
                    </div>
                  </div>
                  <button onClick={() => remove(a.id)} className="text-zinc-300 hover:text-sell"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
