"use client";
import React, { memo } from "react";
import { CheckCircle, ChevronRight } from "lucide-react";

// ── Markdown-aware text renderer ───────────────────────────────────────────────

const MarkdownLine = memo(function MarkdownLine({ text }: { text: string }) {
  if (!text.includes("**") && !text.includes("`")) {
    return <>{text}</>;
  }
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**")) {
          return <strong key={i} className="text-white font-bold">{p.slice(2, -2)}</strong>;
        }
        if (p.startsWith("`") && p.endsWith("`")) {
          return <code key={i} className="px-1 py-0.5 rounded bg-white/5 text-cyan-300 text-[11px] font-mono">{p.slice(1, -1)}</code>;
        }
        return <span key={i}>{p}</span>;
      })}
    </>
  );
});

export const FormattedText = memo(function FormattedText({
  text,
  onOptionClick,
}: {
  text: string;
  onOptionClick?: (t: string) => void;
}) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];

  const flushTable = (key: string) => {
    if (tableBuffer.length < 2) {
      tableBuffer.forEach((l, i) => elements.push(<p key={`${key}-t${i}`} className="text-xs text-slate-400 leading-relaxed">{l}</p>));
      tableBuffer = [];
      return;
    }
    const rows = tableBuffer.filter(l => !l.match(/^\|[\s\-|]+\|$/));
    elements.push(
      <div key={key} className="overflow-x-auto rounded-xl border border-white/5 mt-2 mb-1">
        <table className="w-full text-xs border-collapse">
          <tbody>
            {rows.map((row, ri) => {
              const cells = row.split("|").filter((_, ci) => ci > 0 && ci < row.split("|").length - 1);
              const isHeader = ri === 0;
              return (
                <tr key={ri} className={isHeader ? "bg-white/5" : "border-t border-white/5 hover:bg-white/[0.02]"}>
                  {cells.map((cell, ci) => (
                    <td key={ci} className={`px-3 py-2 ${isHeader ? "font-bold text-white/70 text-[10px] uppercase tracking-wide" : "text-slate-400"}`}>
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  lines.forEach((line, i) => {
    const t = line.trim();
    const key = `l-${i}`;

    // Table row
    if (t.startsWith("|") && t.endsWith("|")) {
      tableBuffer.push(t);
      return;
    } else if (tableBuffer.length > 0) {
      flushTable(`table-${i}`);
    }

    if (!t) { elements.push(<div key={key} className="h-2" />); return; }

    // H1/H2/H3 headers
    if (t.startsWith("### ")) { elements.push(<p key={key} className="text-xs font-bold text-white/70 mt-2 mb-0.5 uppercase tracking-wide">{t.slice(4)}</p>); return; }
    if (t.startsWith("## "))  { elements.push(<p key={key} className="text-sm font-bold text-white mt-2 mb-1">{t.slice(3)}</p>); return; }
    if (t.startsWith("# "))   { elements.push(<p key={key} className="text-base font-extrabold text-white mt-2 mb-1">{t.slice(2)}</p>); return; }

    // Numbered clickable options: "1. ..."
    const numMatch = t.match(/^(\d+)\.\s(.+)$/);
    if (numMatch) {
      elements.push(
        <button
          key={key}
          onClick={() => onOptionClick?.(numMatch[2])}
          className="w-full text-left flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-cyan-500/25 transition-all group cursor-pointer my-0.5"
        >
          <span className="w-6 h-6 rounded-lg bg-white/5 text-[10px] font-black text-white/50 flex items-center justify-center flex-shrink-0 group-hover:bg-cyan-500/15 group-hover:text-cyan-400 transition-colors">
            {numMatch[1]}
          </span>
          <span className="text-xs text-slate-300 flex-1 group-hover:text-white transition-colors">
            <MarkdownLine text={numMatch[2]} />
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
        </button>
      );
      return;
    }

    // Bullet points: "- " or "• "
    if (t.startsWith("- ") || t.startsWith("• ")) {
      elements.push(
        <div key={key} className="flex items-start gap-2.5 pl-1 my-0.5">
          <span className="mt-2 w-1.5 h-1.5 rounded-full bg-white/20 flex-shrink-0" />
          <span className="text-xs text-slate-400 leading-relaxed flex-1">
            <MarkdownLine text={t.replace(/^[-•]\s/, "")} />
          </span>
        </div>
      );
      return;
    }

    // Checkmark lines: "✅ ..."
    if (t.startsWith("✅") || t.startsWith("✓")) {
      const content = t.replace(/^[✅✓]\s*/, "");
      elements.push(
        <div key={key} className="flex items-start gap-2 pl-1 my-0.5">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-slate-350 leading-relaxed flex-1">
            <MarkdownLine text={content} />
          </span>
        </div>
      );
      return;
    }

    // Emoji section headers: "💡 ...", "⚡ ...", "🔑 ...", "🎯 ..."
    if (/^[💡⚡🔑🎯🛡️📊🌍🏠🚗✈️💼]/.test(t)) {
      elements.push(
        <p key={key} className="text-[11px] font-bold text-white/70 mt-3 mb-1 flex items-center gap-1.5 uppercase tracking-wide">
          {t}
        </p>
      );
      return;
    }

    // First line (greeting/opener) — slightly larger
    if (i === 0) {
      elements.push(
        <p key={key} className="text-[13px] font-semibold text-slate-100 leading-relaxed">
          <MarkdownLine text={t} />
        </p>
      );
      return;
    }

    // Normal paragraph
    elements.push(
      <p key={key} className="text-xs text-slate-400 leading-relaxed">
        <MarkdownLine text={t} />
      </p>
    );
  });

  if (tableBuffer.length > 0) flushTable("table-end");

  return <div className="space-y-1.5">{elements}</div>;
});
