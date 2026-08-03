"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { AGENTS, HEX_RING_PATH, type AgentId, type BrandId } from "./geometry";
import { BrandMark } from "./BrandMark";
import { MarkSignature, ThinkingSignature } from "./MarkSignature";
import { hoverRingVariants, hoverVariants, selectionVariants, speakPulse } from "./motion";

export type BadgeState = "idle" | "selected" | "dimmed";

export interface AgentBadgeProps {
  agent: BrandId;
  size?: number;
  state?: BadgeState;
  /** Runs the agent's signature idle animation. */
  animated?: boolean;
  /** One acknowledgement beat — raise when the agent sends a message. */
  speaking?: boolean;
  /** Slow rotation and orbiting motes while the agent works. */
  thinking?: boolean;
  showLabel?: boolean;
  showRole?: boolean;
  onSelect?: (agent: BrandId) => void;
  className?: string;
}

/**
 * An agent's mark as an interactive element.
 *
 * Everything the brand does on screen goes through here — hover, selection,
 * speaking, thinking — so the behaviour is identical wherever a mark appears
 * and there is exactly one place to change it.
 *
 * It renders as a `button` when it can be chosen and a plain `div` when it
 * cannot, rather than a div with a click handler: a control that cannot be
 * reached by keyboard is not a control.
 */
export function AgentBadge({
  agent,
  size = 88,
  state = "idle",
  animated = false,
  speaking = false,
  thinking = false,
  showLabel = true,
  showRole = false,
  onSelect,
  className,
}: AgentBadgeProps) {
  const reduced = useReducedMotion();
  const tone = AGENTS[agent];
  const interactive = !!onSelect;
  const Wrapper = interactive ? motion.button : motion.div;

  return (
    <Wrapper
      type={interactive ? "button" : undefined}
      onClick={interactive ? () => onSelect(agent) : undefined}
      aria-pressed={interactive ? state === "selected" : undefined}
      aria-label={interactive ? `${tone.name} — ${tone.role}` : undefined}
      initial="rest"
      whileHover={interactive && !reduced ? "hover" : undefined}
      whileFocus={interactive && !reduced ? "hover" : undefined}
      animate={state === "idle" ? "idle" : state}
      variants={selectionVariants}
      className={cn(
        "group flex flex-col items-center gap-2.5",
        interactive &&
          "cursor-pointer rounded-3xl p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
        className
      )}
      style={interactive ? ({ ["--tw-ring-color" as string]: tone.glow }) : undefined}
    >
      <motion.span variants={hoverVariants} className="relative block">
        <BrandMark
          brand={agent}
          size={size}
          title={showLabel ? null : `${tone.name} — ${tone.role}`}
          className="relative z-10"
        >
          {/* Hover ring — appears and turns slowly. */}
          <motion.g variants={hoverRingVariants} style={{ transformOrigin: "50% 50%" }}>
            <path
              d={HEX_RING_PATH}
              fill="none"
              stroke={tone.bright}
              strokeWidth={1.6}
              strokeDasharray="10 8"
            />
          </motion.g>

          {agent !== "aegis" && animated && !thinking && (
            <MarkSignature agent={agent as AgentId} active />
          )}
          {thinking && <ThinkingSignature agent={agent} />}
        </BrandMark>

        {/* Ambient glow. A filtered blur behind the mark rather than a box
            shadow, so it follows the hexagon instead of a rectangle. */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 rounded-full blur-xl transition-opacity duration-300"
          style={{ background: tone.glow }}
          animate={
            speaking && !reduced
              ? { opacity: [0.35, 0.85, 0.35], scale: [1, 1.15, 1] }
              : { opacity: state === "selected" ? 0.6 : 0.3 }
          }
          transition={speaking ? { duration: 0.9 } : { duration: 0.3 }}
        />
      </motion.span>

      {showLabel && (
        <motion.span
          variants={speakPulse}
          animate={speaking && !reduced ? "speak" : "rest"}
          className="flex flex-col items-center gap-0.5 text-center"
        >
          <span className="text-[13px] font-black uppercase tracking-wider text-slate-900 dark:text-white">
            {tone.name}
          </span>
          {showRole && (
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {tone.role}
            </span>
          )}
        </motion.span>
      )}
    </Wrapper>
  );
}
