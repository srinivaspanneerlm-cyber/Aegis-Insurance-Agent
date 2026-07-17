"use client";

import { useTheme } from "@/context/ThemeContext";

/** Theme-aware ambient gradient/mesh backdrop behind the About page. */
export function AboutAmbientBackground() {
  const { theme } = useTheme();

  return theme === "dark" ? (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div className="absolute top-[15%] left-[-10%] w-[55%] h-[55%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none" />
    </>
  ) : (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.04),rgba(255,255,255,0))]" />
      <div className="absolute top-[10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-royal-100/40 blur-[100px] pointer-events-none" />
    </>
  );
}
