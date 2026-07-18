/** Per-rank visual styling for the plan cards (index 0 = best match). */
export interface RankConfig {
  label: string;
  badge: string;
  border: string;
  glow: string;
  scoreBg: string;
  scoreText: string;
  btnGrad: string;
  rankDot: string;
}

export const RANK_CONFIGS: RankConfig[] = [
  {
    label: "Best Match",
    badge: "bg-amber-500/15 text-amber-400 border-amber-500/25",
    border: "border-2 border-cyan-500/35",
    glow: "shadow-[0_4px_24px_rgba(6,182,212,0.10)]",
    scoreBg: "bg-cyan-500/10",
    scoreText: "text-cyan-400",
    btnGrad: "from-cyan-500 to-teal-500",
    rankDot: "bg-amber-400",
  },
  {
    label: "Strong Pick",
    badge: "bg-slate-500/15 text-slate-400 border-slate-500/25",
    border: "border border-white/10",
    glow: "",
    scoreBg: "bg-blue-500/10",
    scoreText: "text-blue-400",
    btnGrad: "from-blue-500 to-indigo-500",
    rankDot: "bg-slate-400",
  },
  {
    label: "Alternative",
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    border: "border border-white/8",
    glow: "",
    scoreBg: "bg-violet-500/10",
    scoreText: "text-violet-400",
    btnGrad: "from-violet-500 to-purple-500",
    rankDot: "bg-violet-400",
  },
];

export const RANK_FALLBACK: RankConfig = {
  label: "Option", badge: "", border: "border border-white/8",
  glow: "", scoreBg: "", scoreText: "text-white", btnGrad: "from-slate-500 to-slate-600",
  rankDot: "bg-white/30",
};

/** Styling for the card at the given rank index, falling back past rank 3. */
export const getRankConfig = (index: number): RankConfig =>
  RANK_CONFIGS[index] ?? RANK_FALLBACK;
