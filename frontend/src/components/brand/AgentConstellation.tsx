"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { AGENTS, AGENT_ORDER, type AgentId, type BrandId } from "./geometry";
import { AgentBadge, type BadgeState } from "./AgentBadge";
import { RoutingBeam } from "./RoutingBeam";
import { cardVariants, revealGroupVariants, revealVariants } from "./motion";

export interface AgentConstellationProps {
  /** Show the Executive above the row and allow delegation beams. */
  showExecutive?: boolean;
  /** Which agent is currently speaking, if any. */
  speaking?: AgentId | null;
  /** Which agent is working, if any. */
  thinking?: AgentId | null;
  /** Called when a customer picks an agent. */
  onSelect?: (agent: AgentId) => void;
  /** Rendered under the row when an agent is selected. */
  renderCard?: (agent: AgentId) => React.ReactNode;
  className?: string;
}

/**
 * The agent line-up.
 *
 * Reveals in order as it scrolls into view, responds to hover, and centres a
 * chosen agent while the others recede. When the Executive is shown, choosing
 * an agent also draws the delegation beam — the platform explaining, visually,
 * which specialist it is handing you to.
 *
 * The reveal fires once (`viewport.once`). A row that re-animates every time it
 * scrolls past is a distraction, not a delight.
 */
export function AgentConstellation({
  showExecutive = false,
  speaking = null,
  thinking = null,
  onSelect,
  renderCard,
  className,
}: AgentConstellationProps) {
  const [selected, setSelected] = useState<AgentId | null>(null);
  const [routingTo, setRoutingTo] = useState<AgentId | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const executiveRef = useRef<HTMLDivElement>(null);
  const agentRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const targetRef = useRef<HTMLElement | null>(null);

  const choose = (brand: BrandId) => {
    const agent = brand as AgentId;
    const next = selected === agent ? null : agent;
    setSelected(next);

    if (next && showExecutive) {
      targetRef.current = agentRefs.current[next] ?? null;
      setRoutingTo(next);
    } else {
      setRoutingTo(null);
    }
    if (next) onSelect?.(next);
  };

  const stateFor = (agent: AgentId): BadgeState => {
    if (!selected) return "idle";
    return selected === agent ? "selected" : "dimmed";
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {showExecutive && (
        <div className="mb-10 flex justify-center">
          <div ref={executiveRef}>
            <AgentBadge
              agent="aegis"
              size={104}
              showLabel
              showRole
              thinking={thinking !== null && !selected}
            />
          </div>
        </div>
      )}

      <RoutingBeam
        containerRef={containerRef}
        fromRef={executiveRef}
        toRef={targetRef}
        agent={routingTo}
        active={routingTo !== null}
        onComplete={() => setRoutingTo(null)}
      />

      <motion.ul
        variants={revealGroupVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.35 }}
        className="flex flex-wrap items-start justify-center gap-6 sm:gap-10"
      >
        {AGENT_ORDER.map((agent) => (
          <motion.li key={agent} variants={revealVariants}>
            <div ref={(el) => { agentRefs.current[agent] = el; }}>
              <AgentBadge
                agent={agent}
                state={stateFor(agent)}
                animated={selected === agent || (!selected && speaking === agent)}
                speaking={speaking === agent}
                thinking={thinking === agent}
                showRole
                onSelect={choose}
              />
            </div>
          </motion.li>
        ))}
      </motion.ul>

      <AnimatePresence mode="wait">
        {selected && renderCard && (
          <motion.div
            key={selected}
            variants={cardVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="mt-10"
          >
            {renderCard(selected)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The selection is a real state change, so say so out loud. */}
      <p className="sr-only" aria-live="polite">
        {selected ? `${AGENTS[selected].name} selected — ${AGENTS[selected].role}` : ""}
      </p>
    </div>
  );
}
