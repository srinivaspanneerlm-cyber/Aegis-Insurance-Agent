"use client";

import { motion } from "framer-motion";
import { BrandLogo } from "./navbar/BrandLogo";
import { SearchBar } from "./navbar/SearchBar";
import { ThemeToggle } from "./navbar/ThemeToggle";
import { AuthButtons } from "./navbar/AuthButtons";
import { PrimaryNav } from "./navbar/PrimaryNav";

interface NavbarProps {
  onLoginClick?: () => void;
}

export default function Navbar({ onLoginClick }: NavbarProps) {
  const navBgClass = "bg-white/90 border-b border-slate-200/60 backdrop-blur-xl shadow-sm dark:bg-slate-950/75 dark:border-b dark:border-white/5 dark:backdrop-blur-xl dark:shadow-none";

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBgClass}`}
    >
      {/* ROW 1: THE FOUR-ELEMENT TOP BAR */}
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        <BrandLogo />
        <SearchBar />

        {/* RIGHT ZONE: THEME TOGGLE & LOGIN BUTTON */}
        <div className="flex items-center gap-5 flex-shrink-0">
          <ThemeToggle />
          <AuthButtons onLoginClick={onLoginClick} />
        </div>
      </div>

      {/* ROW 2: SECOND GLASSMORPHIC NAVIGATION BAR */}
      <PrimaryNav />
    </motion.nav>
  );
}
