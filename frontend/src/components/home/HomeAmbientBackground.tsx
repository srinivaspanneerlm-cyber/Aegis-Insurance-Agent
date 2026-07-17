"use client";

import { useTheme } from "@/context/ThemeContext";

/** Theme-aware ambient gradient/mesh backdrop behind the landing page. */
export function HomeAmbientBackground() {
  const { theme } = useTheme();

  return theme === "dark" ? (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />
      <div className="absolute top-[10%] left-[-15%] w-[60%] h-[60%] rounded-full bg-purple-650/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[-10%] w-[55%] h-[55%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
    </>
  ) : (
    <>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(59,130,246,0.05),rgba(255,255,255,0))]" />
      <div className="absolute top-[10%] left-[-10%] w-[45%] h-[45%] rounded-full bg-royal-100/50 blur-[90px] pointer-events-none" />
    </>
  );
}
