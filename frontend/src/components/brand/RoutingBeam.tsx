"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AGENTS, type BrandId } from "./geometry";
import { EASE_OUT } from "./motion";

interface RoutingBeamProps {
  /** The element the beam leaves — the Executive mark. */
  fromRef: RefObject<HTMLElement | null>;
  /** The element it arrives at. Null means no delegation in flight. */
  toRef: RefObject<HTMLElement | null>;
  /** Positioned container both elements live inside. */
  containerRef: RefObject<HTMLElement | null>;
  /** Colours the beam in the receiving agent's tone. */
  agent: BrandId | null;
  /** Raise to play the delegation. */
  active: boolean;
  onComplete?: () => void;
}

interface Geometry {
  from: { x: number; y: number };
  to: { x: number; y: number };
  width: number;
  height: number;
}

/**
 * The line of energy that shows the Executive handing a customer to a
 * specialist.
 *
 * Positions are measured from the real elements rather than hard-coded, so the
 * beam stays correct when the row wraps on a narrow screen or the layout
 * changes — a delegation that visually points at the wrong agent would be worse
 * than no animation at all.
 *
 * It is purely illustrative: the transfer itself is decided and consented to
 * elsewhere. Nothing here initiates or completes a handover.
 */
export function RoutingBeam({
  fromRef,
  toRef,
  containerRef,
  agent,
  active,
  onComplete,
}: RoutingBeamProps) {
  const reduced = useReducedMotion();
  const [geo, setGeo] = useState<Geometry | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    const from = fromRef.current;
    const to = toRef.current;
    if (!container || !from || !to) return setGeo(null);

    const box = container.getBoundingClientRect();
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();

    setGeo({
      from: { x: a.left + a.width / 2 - box.left, y: a.top + a.height / 2 - box.top },
      to: { x: b.left + b.width / 2 - box.left, y: b.top + b.height / 2 - box.top },
      width: box.width,
      height: box.height,
    });
  }, [containerRef, fromRef, toRef]);

  useEffect(() => {
    if (!active) return;
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [active, measure]);

  if (!active || !agent || !geo || reduced) return null;

  const tone = AGENTS[agent];
  // A gentle arc rather than a straight line — it reads as a route being taken
  // rather than a wire that was always there.
  const midX = (geo.from.x + geo.to.x) / 2;
  const midY = (geo.from.y + geo.to.y) / 2 - Math.abs(geo.to.x - geo.from.x) * 0.18 - 20;
  const d = `M ${geo.from.x} ${geo.from.y} Q ${midX} ${midY} ${geo.to.x} ${geo.to.y}`;

  return (
    <AnimatePresence>
      <motion.svg
        key={`${agent}-${geo.to.x}`}
        className="pointer-events-none absolute inset-0 z-20"
        width={geo.width}
        height={geo.height}
        fill="none"
        aria-hidden
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <defs>
          <linearGradient id={`beam-${agent}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={AGENTS.aegis.bright} stopOpacity="0.1" />
            <stop offset="50%" stopColor={tone.bright} stopOpacity="0.95" />
            <stop offset="100%" stopColor={tone.bright} stopOpacity="0.2" />
          </linearGradient>
        </defs>

        <motion.path
          d={d}
          stroke={`url(#beam-${agent})`}
          strokeWidth={2.5}
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.1, ease: EASE_OUT, times: [0, 0.2, 0.75, 1] }}
          onAnimationComplete={onComplete}
        />

        {/* The packet itself, so the direction of the handover is unmistakable. */}
        <motion.circle r={4} fill={tone.bright}>
          <animateMotion dur="1.1s" repeatCount="1" fill="freeze" path={d} />
        </motion.circle>
      </motion.svg>
    </AnimatePresence>
  );
}
