"use client";

import { ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface JumpToLatestProps {
  /** Whether the reader has scrolled away from the newest message. */
  show: boolean;
  /** Return the viewport to the latest message. */
  onClick: () => void;
}

/**
 * Floating "jump to latest" pill shown when the reader has scrolled up in the
 * transcript. Purely presentational — it renders on `show` and reports a click;
 * it holds no chat state and never touches the streaming/voice path.
 */
export function JumpToLatest({ show, onClick }: JumpToLatestProps) {
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={onClick}
          aria-label="Jump to latest message"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.18 }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-slate-900/90 backdrop-blur px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-200 shadow-[0_8px_24px_rgba(0,0,0,0.5)] transition-colors hover:text-white hover:border-cyan-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        >
          <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
          Latest
        </motion.button>
      )}
    </AnimatePresence>
  );
}
