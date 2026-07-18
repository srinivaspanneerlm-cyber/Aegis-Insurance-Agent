"use client";

/** Cyber-grid, scrollbar styles, and ambient glow layers behind the workspace. */
export function AdvisorBackdrop({ glowColor }: { glowColor: string }) {
  return (
    <>
      <style jsx global>{`
        .chat-scroll::-webkit-scrollbar { width: 4px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 99px; }
        .chat-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      `}</style>

      {/* Cyber grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.012)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.012)_1px,transparent_1px)] bg-[size:36px_36px] pointer-events-none opacity-50 z-0" />

      {/* Ambient glow */}
      <div
        style={{ background: `radial-gradient(circle, ${glowColor} 0%, rgba(0,0,0,0) 70%)` }}
        className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none z-0 transition-all duration-700"
      />
      <div className="absolute bottom-[10%] right-[-5%] w-[350px] h-[350px] rounded-full bg-cyan-500/5 blur-[100px] pointer-events-none z-0" />
    </>
  );
}
