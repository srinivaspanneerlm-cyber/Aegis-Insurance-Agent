/**
 * Aegis AI brand system. Import from `@/components/brand`.
 *
 * One mark component, one motion vocabulary, one geometry source. The static
 * files in `public/brand` are generated from that same geometry by
 * `scripts/build-brand-assets.mjs`, so a mark cannot say one thing in the
 * product and another in a deck.
 *
 * See `README.md` in this folder for usage and the asset inventory.
 */

export { BrandMark, type BrandMarkProps, type MarkVariant } from "./BrandMark";
export { AgentAvatar, type AgentAvatarProps } from "./AgentAvatar";
export { AgentBadge, type AgentBadgeProps, type BadgeState } from "./AgentBadge";
export { AgentConstellation, type AgentConstellationProps } from "./AgentConstellation";
export { RoutingBeam } from "./RoutingBeam";
export { MarkSignature, ThinkingSignature, OuterRing } from "./MarkSignature";

export {
  EASE_OUT,
  SPRING,
  SPRING_SOFT,
  REVEAL_STAGGER,
  revealVariants,
  revealGroupVariants,
  hoverVariants,
  hoverRingVariants,
  selectionVariants,
  speakPulse,
  cardVariants,
} from "./motion";

export {
  AGENTS,
  AGENT_ORDER,
  GLYPHS,
  HEX_PATH,
  HEX_RING_PATH,
  AEGIS,
  VIEWBOX,
  SAFE_PADDING,
  MONO_INK,
  type AgentId,
  type BrandId,
  type BrandTone,
} from "./geometry";
