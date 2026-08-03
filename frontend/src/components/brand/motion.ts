import type { Transition, Variants } from "framer-motion";

/**
 * Motion vocabulary for the Aegis brand.
 *
 * One place for every duration, easing and spring the marks use, because a
 * brand reads as considered when its motion is consistent and as cheap when it
 * is not. Components import these rather than inventing their own numbers.
 *
 * The register is deliberately restrained — enterprise, not arcade. Nothing
 * bounces past its target, nothing spins for decoration, and every motion is
 * short enough to feel like feedback rather than a performance.
 */

/** Standard ease-out. Fast to start, settles gently — reads as responsive. */
export const EASE_OUT: Transition["ease"] = [0.16, 1, 0.3, 1];

/** For state changes that should feel physical: selection, expansion. */
export const SPRING: Transition = { type: "spring", stiffness: 260, damping: 26 };

/** Gentler spring for large moves, so nothing overshoots dramatically. */
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 180, damping: 24 };

/** Reveal cadence — the 300ms stagger the agent row uses. */
export const REVEAL_STAGGER = 0.3;

/**
 * Scroll reveal for a single mark: fade, scale and a 2° settle.
 *
 * The tilt is small on purpose. Two degrees is enough for the eye to register
 * arrival; more looks like a slide transition from a different product.
 */
export const revealVariants: Variants = {
  hidden: { opacity: 0, scale: 0.88, rotate: -2, y: 14 },
  visible: {
    opacity: 1,
    scale: 1,
    rotate: 0,
    y: 0,
    transition: { duration: 0.55, ease: EASE_OUT },
  },
};

/** Parent of a revealed row — drives the sequential 300ms cascade. */
export const revealGroupVariants: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: REVEAL_STAGGER, delayChildren: 0.1 } },
};

/**
 * Hover: the mark lifts slightly and its glow strengthens. Scale stays under
 * 1.08 — beyond that a badge in a row starts colliding with its neighbours.
 */
export const hoverVariants: Variants = {
  rest: { scale: 1, transition: { duration: 0.28, ease: EASE_OUT } },
  hover: { scale: 1.06, transition: { duration: 0.28, ease: EASE_OUT } },
};

/** The outer ring that appears and rotates on hover. */
export const hoverRingVariants: Variants = {
  rest: { opacity: 0, scale: 0.92, rotate: 0 },
  hover: {
    opacity: 0.75,
    scale: 1,
    rotate: 360,
    transition: {
      opacity: { duration: 0.25 },
      scale: { duration: 0.25, ease: EASE_OUT },
      rotate: { duration: 14, ease: "linear", repeat: Infinity },
    },
  },
};

/** Selection: the chosen mark centres and grows, the rest recede. */
export const selectionVariants: Variants = {
  idle: { scale: 1, opacity: 1, transition: SPRING },
  selected: { scale: 1.18, opacity: 1, transition: SPRING },
  dimmed: { scale: 0.9, opacity: 0.25, transition: { duration: 0.32, ease: EASE_OUT } },
};

/** One beat of acknowledgement when an agent speaks. */
export const speakPulse: Variants = {
  rest: { scale: 1 },
  speak: {
    scale: [1, 1.09, 0.98, 1.03, 1],
    transition: { duration: 0.9, ease: EASE_OUT },
  },
};

/** Card reveal that accompanies a selection. */
export const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: SPRING_SOFT },
  exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.2 } },
};

/**
 * Respect the reader. Anything decorative and looping must be able to stop —
 * vestibular disorders are common, and a permanently orbiting particle is
 * exactly the kind of motion that triggers them.
 */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
