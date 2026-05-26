"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  symbol: string;
  defaultInterval?: string;
}

const INTERVALS = ["1D", "4H", "1H", "1W"] as const;

export default function TradingViewWidget({ symbol, defaultInterval = "1D" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [interval, setInterval] = useState(defaultInterval);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || collapsed) return;
    containerRef.current.innerHTML = "";

    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container__widget";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
    containerRef.current.appendChild(wrapper);

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval,
      timezone: "Asia/Bangkok",
      theme: "light",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
    });
    containerRef.current.appendChild(script);

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
              key={iv}
              onClick={() => setInterval(iv)}
              className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
                interval === iv
                  ? "bg-white/10 text-white"
                  : "text-[#787b86] hover:text-white"
              }`}
            >
              {iv}
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
        <div ref={containerRef} style={{ height: 380 }} />
      )}
    </div>
  );
}
