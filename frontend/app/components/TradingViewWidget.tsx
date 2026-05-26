"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  symbol: string;
  defaultInterval?: string;
}

const INTERVALS: { label: string; tv: string }[] = [
  { label: "1H", tv: "60" },
  { label: "4H", tv: "240" },
  { label: "1D", tv: "D" },
  { label: "1W", tv: "W" },
];

let scriptLoaded = false;
let scriptLoading = false;
const callbacks: (() => void)[] = [];

function loadTvScript(cb: () => void) {
  if (scriptLoaded) { cb(); return; }
  callbacks.push(cb);
  if (scriptLoading) return;
  scriptLoading = true;
  const s = document.createElement("script");
  s.src = "https://s3.tradingview.com/tv.js";
  s.onload = () => {
    scriptLoaded = true;
    callbacks.forEach((fn) => fn());
    callbacks.length = 0;
  };
  document.head.appendChild(s);
}

export default function TradingViewWidget({ symbol, defaultInterval = "1D" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [interval, setInterval] = useState(
    INTERVALS.find((i) => i.label === defaultInterval)?.tv ?? "D"
  );
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (collapsed || !containerRef.current) return;

    containerRef.current.innerHTML = "";
    const id = `tv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    containerRef.current.id = id;

    loadTvScript(() => {
      if (!containerRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      new (window as any).TradingView.widget({
        container_id: id,
        symbol,
        interval,
        timezone: "Asia/Bangkok",
        theme: "light",
        style: "1",
        locale: "en",
        autosize: true,
        hide_top_toolbar: false,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        save_image: false,
        withdateranges: true,
        height: 380,
      });
    });

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [symbol, interval, collapsed]);

  return (
    <div className="border border-line bg-white overflow-hidden">
      <div className="flex items-center justify-between border-b border-line bg-[#131722] px-4 py-2">
        <div className="flex gap-1">
          {INTERVALS.map((iv) => (
            <button
              key={iv.label}
              onClick={() => setInterval(iv.tv)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                interval === iv.tv
                  ? "bg-white/10 text-white"
                  : "text-[#787b86] hover:text-white"
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-[11px] text-[#787b86] hover:text-white transition-colors"
        >
          {collapsed ? "▼ show chart" : "▲ hide"}
        </button>
      </div>

      {!collapsed && (
        <div ref={containerRef} style={{ height: 380, width: "100%" }} />
      )}
    </div>
  );
}
