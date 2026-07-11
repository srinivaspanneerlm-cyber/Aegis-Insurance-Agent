"use client";

interface Props {
  agentName: string;
  agentDomain: string;
  isActive: boolean;
  responseTimeMs?: number;
}

export default function EnvironmentBadge({
  agentName,
  agentDomain,
  isActive,
  responseTimeMs,
}: Props) {
  return (
    <div
      className="
        inline-flex items-center gap-1.5
        px-2.5 py-1
        rounded-lg
        border border-white/10
        bg-slate-900/60
        backdrop-blur-sm
        text-xs font-mono
        select-none
      "
    >
      {/* Status dot */}
      <span
        className={`
          w-1.5 h-1.5 rounded-full flex-shrink-0
          ${isActive ? "bg-emerald-400" : "bg-slate-600"}
        `}
      />

      {/* Domain tag */}
      <span className="text-slate-500 uppercase tracking-wider text-[9px] font-bold">
        {agentDomain.replace("-", "‑")}
      </span>

      {/* Separator */}
      <span className="w-px h-3 bg-white/10 flex-shrink-0" />

      {/* Agent name */}
      <span className="text-slate-300 font-semibold text-[10px]">
        {agentName}
      </span>

      {/* Response time — shown only when provided */}
      {responseTimeMs !== undefined && (
        <>
          <span className="w-px h-3 bg-white/10 flex-shrink-0" />
          <span className="text-cyan-400 text-[9px] font-bold">
            {Math.round(responseTimeMs)}ms
          </span>
        </>
      )}
    </div>
  );
}
