"use client";

export default function DailyReport({ summary, date }: { summary: string; date: string }) {
  // Convert markdown to simple formatted paragraphs without external deps
  const lines = summary.split("\n");

  return (
    <div className="border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line bg-panel px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
          📊 Daily IDS Report
        </span>
        <span className="text-[10px] text-zinc-400 tabular-nums">{date}</span>
      </div>
      <div className="px-5 py-4 space-y-1 text-sm text-zinc-700 leading-relaxed">
        {lines.map((line, i) => {
          if (!line.trim()) return <div key={i} className="h-2" />;
          if (line.startsWith("# ")) return <h2 key={i} className="text-base font-semibold text-ink mt-3">{line.slice(2)}</h2>;
          if (line.startsWith("## ")) return <h3 key={i} className="text-sm font-semibold text-ink mt-2">{line.slice(3)}</h3>;
          if (line.startsWith("### ")) return <h4 key={i} className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mt-2">{line.slice(4)}</h4>;
          if (line.startsWith("---")) return <hr key={i} className="border-line my-3" />;
          if (line.startsWith("> ")) return <blockquote key={i} className="border-l-2 border-zinc-300 pl-3 text-zinc-600 italic">{line.slice(2)}</blockquote>;
          if (line.startsWith("- ") || line.startsWith("* ")) return <div key={i} className="flex gap-2"><span className="text-zinc-400 shrink-0">·</span><span>{line.slice(2)}</span></div>;
          if (/^\d+\. /.test(line)) return <div key={i} className="flex gap-2"><span className="text-zinc-400 shrink-0 tabular-nums">{line.match(/^\d+/)?.[0]}.</span><span>{line.replace(/^\d+\. /, "")}</span></div>;
          // Bold
          const boldLine = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
          return <p key={i} dangerouslySetInnerHTML={{ __html: boldLine }} className="text-zinc-600" />;
        })}
      </div>
    </div>
  );
}
