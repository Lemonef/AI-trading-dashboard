"use client";

import ReactMarkdown from "react-markdown";

export default function DailyReport({ summary, date }: { summary: string; date: string }) {
  return (
    <div className="border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line bg-panel px-5 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-400">
          📊 Daily IDS Report
        </span>
        <span className="text-[10px] text-zinc-400 tabular-nums">{date}</span>
      </div>
      <div className="prose prose-sm max-w-none px-5 py-4
        prose-headings:font-semibold prose-headings:text-ink prose-headings:mt-4 prose-headings:mb-2
        prose-h1:text-base prose-h2:text-sm prose-h3:text-xs prose-h3:uppercase prose-h3:tracking-wide
        prose-p:text-zinc-600 prose-p:leading-relaxed prose-p:my-1.5
        prose-strong:text-ink prose-strong:font-semibold
        prose-ul:my-1.5 prose-li:text-zinc-600 prose-li:my-0.5
        prose-hr:border-line prose-hr:my-4
        prose-blockquote:border-l-2 prose-blockquote:border-zinc-300 prose-blockquote:pl-3 prose-blockquote:text-zinc-600 prose-blockquote:not-italic
        prose-code:text-xs prose-code:bg-panel prose-code:px-1 prose-code:rounded prose-code:text-zinc-700
        prose-table:text-xs prose-th:text-zinc-500 prose-th:font-semibold prose-td:text-zinc-600
      ">
        <ReactMarkdown>{summary}</ReactMarkdown>
      </div>
    </div>
  );
}
