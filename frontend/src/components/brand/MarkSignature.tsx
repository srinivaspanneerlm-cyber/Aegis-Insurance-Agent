"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  AGENTS,
  GLYPHS,
  HEX_PATH,
  HEX_RING_PATH,
  VIEWBOX,
  type AgentId,
} from "./geometry";
import { EASE_OUT } from "./motion";

/**
 * Each agent's signature idle animation, drawn over its mark.
 *
 * Every signature is built from the same four primitives below rather than
 * hand-rolled per agent, so they share a rhythm and read as one system. What
 * differs is what each one says about its domain: Sarah has a pulse because
 * health does, Emma's house draws itself because property is something you
 * build, Ethan orbits because travel goes somewhere.
 *
 * All of it is decorative, so all of it stops under `prefers-reduced-motion`.
 * The mark underneath stays fully legible without a single frame of motion.
 */

interface SignatureProps {
  agent: AgentId;
  /** Off by default — a page of permanently animating logos is noise. */
  active?: boolean;
}

// ── Primitives ───────────────────────────────────────────────────────────────

/** An expanding, fading hexagon — the "shield pulse" every agent shares. */
function PulseRing({ colour, delay = 0, duration = 2.6 }: { colour: string; delay?: number; duration?: number }) {
  return (
    <motion.path
      d={HEX_RING_PATH}
      fill="none"
      stroke={colour}
      strokeWidth={2}
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: [0, 0.5, 0], scale: [0.82, 1.12, 1.18] }}
      transition={{ duration, delay, repeat: Infinity, ease: EASE_OUT, repeatDelay: 0.4 }}
      style={{ transformOrigin: "50% 50%" }}
    />
  );
}

/** A path that draws itself, then holds. */
function DrawPath({
  d,
  colour,
  width = 3.4,
  duration = 1.6,
  delay = 0,
}: {
  d: string;
  colour: string;
  width?: number;
  duration?: number;
  delay?: number;
}) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={colour}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: [0, 1, 1, 0], opacity: [0, 1, 1, 0] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut", times: [0, 0.45, 0.8, 1] }}
    />
  );
}

/** A mote travelling the hexagon — SMIL, because following a path is exactly
 *  what `animateMotion` is for and it costs no JavaScript per frame. */
function OrbitDot({ colour, duration = 6, r = 3 }: { colour: string; duration?: number; r?: number }) {
  return (
    <circle r={r} fill={colour}>
      <animateMotion dur={`${duration}s`} repeatCount="indefinite" path={HEX_RING_PATH} rotate="auto" />
    </circle>
  );
}

/** A horizontal band sweeping the mark — a scan line. */
function ScanSweep({ colour, duration = 2.8 }: { colour: string; duration?: number }) {
  return (
    <motion.rect
      x={30}
      width={68}
      height={2.5}
      rx={1.25}
      fill={colour}
      initial={{ y: 52, opacity: 0 }}
      animate={{ y: [52, 78, 52], opacity: [0, 0.9, 0] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ── Signatures ───────────────────────────────────────────────────────────────

export function MarkSignature({ agent, active = false }: SignatureProps) {
  const reduced = useReducedMotion();
  const tone = AGENTS[agent];

  if (!active || reduced) return null;

  switch (agent) {
    // Motor — an electric charge circling the shield, and a steady pulse.
    case "alex":
      return (
        <g>
          <PulseRing colour={tone.bright} duration={2.4} />
          <OrbitDot colour={tone.bright} duration={5} />
        </g>
      );

    // Health — the ECG traces itself across the heart, in time with a beat.
    case "sarah":
      return (
        <g>
          <PulseRing colour={tone.bright} duration={1.8} />
          {GLYPHS.sarah.stroke?.map((d, i) => (
            <DrawPath key={i} d={d} colour="#FFFFFF" width={4} duration={1.8} />
          ))}
        </g>
      );

    // Property — the house builds itself, then the shield settles around it.
    case "emma":
      return (
        <g>
          <PulseRing colour={tone.bright} duration={3.2} />
          {GLYPHS.emma.stroke?.map((d, i) => (
            <DrawPath key={i} d={d} colour="#FFFFFF" duration={3.2} delay={i * 0.22} />
          ))}
        </g>
      );

    // Travel — the journey goes around the shield and comes back.
    case "ethan":
      return (
        <g>
          <PulseRing colour={tone.bright} duration={3} />
          <g>
            {/* The aircraft itself makes the trip, banked along the path. */}
            <path
              d="M0 -5 L2 -1 L7 1.5 L7 3 L2 2 L2 4.5 L3.5 6 L3.5 7 L0 6 L-3.5 7 L-3.5 6 L-2 4.5 L-2 2 L-7 3 L-7 1.5 L-2 -1 Z"
              fill={tone.bright}
            >
              <animateMotion dur="7s" repeatCount="indefinite" path={HEX_RING_PATH} rotate="auto" />
            </path>
          </g>
        </g>
      );

    // Claims & fraud — the visor scans, and the radar sweeps behind it.
    case "nova":
      return (
        <g>
          <PulseRing colour={tone.bright} duration={2.2} />
          <ScanSweep colour={tone.bright} />
          {GLYPHS.nova.dots?.map((dot, i) => (
            <motion.circle
              key={i}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill="#FFFFFF"
              initial={{ opacity: 0.2 }}
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
            />
          ))}
        </g>
      );

    default:
      return null;
  }
}

/**
 * The thinking state: the mark turns slowly inside an orbit of motes.
 *
 * Shared by every agent because "working" is a platform state, not a domain
 * one — the customer should recognise it instantly whichever advisor they are
 * talking to.
 */
export function ThinkingSignature({ agent }: { agent: AgentId | "aegis" }) {
  const reduced = useReducedMotion();
  const tone = AGENTS[agent];
  if (reduced) return null;

  return (
    <g>
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        style={{ transformOrigin: "50% 50%" }}
      >
        <path d={HEX_RING_PATH} fill="none" stroke={tone.bright} strokeWidth={1.5} opacity={0.28} />
        {[0, 1, 2].map((i) => (
          <OrbitDot key={i} colour={tone.bright} duration={3.4 + i * 0.9} r={2.4} />
        ))}
      </motion.g>
      <motion.path
        d={HEX_PATH}
        fill="none"
        stroke={tone.bright}
        strokeWidth={1.5}
        animate={{ opacity: [0.15, 0.5, 0.15] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      />
    </g>
  );
}

/** Shared by hover and selection — a ring that appears outside the mark. */
export function OuterRing({ colour, opacity = 0.7 }: { colour: string; opacity?: number }) {
  return (
    <path
      d={HEX_RING_PATH}
      fill="none"
      stroke={colour}
      strokeWidth={1.6}
      opacity={opacity}
      strokeDasharray="10 8"
    />
  );
}

export const MARK_CENTRE = VIEWBOX / 2;
