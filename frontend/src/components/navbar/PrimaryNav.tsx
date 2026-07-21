"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { menuItems } from "./navData";
import { MegaMenu } from "./MegaMenu";

/** Secondary navigation row with the product mega-menu trigger. */
export function PrimaryNav() {
  const pathname = usePathname();

  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Safe dropdown hover delay orchestration
  const handleMouseEnter = () => {
    if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    setIsMegaMenuOpen(true);
  };

  const handleMouseLeave = () => {
    menuTimeoutRef.current = setTimeout(() => {
      setIsMegaMenuOpen(false);
    }, 150);
  };

  useEffect(() => {
    return () => {
      if (menuTimeoutRef.current) clearTimeout(menuTimeoutRef.current);
    };
  }, []);

  const secondNavBgClass = "bg-slate-100/50 border-t border-slate-200/50 dark:bg-slate-900/50 dark:border-t dark:border-white/5";

  return (
    <div className={`py-2.5 relative ${secondNavBgClass}`}>
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-center gap-8 md:gap-12 flex-wrap">
        {menuItems.map((item, index) => {
          const isActive = pathname === item.href;

          if (item.isMega) {
            return (
              <div
                key={index}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                className="relative py-1"
              >
                <button
                  onClick={() => setIsMegaMenuOpen(!isMegaMenuOpen)}
                  aria-expanded={isMegaMenuOpen}
                  aria-haspopup="true"
                  className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 duration-200 relative group cursor-pointer bg-transparent border-0 outline-none ${
                    isActive
                      ? "text-purple-600 dark:text-cyan-400"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  }`}
                >
                  {item.icon}
                  <span>{item.name}</span>

                  {/* Active/Hover Line */}
                  <span className={`absolute -bottom-3.5 left-0 right-0 h-[2px] rounded-full transition-all duration-300 ${
                    isActive || isMegaMenuOpen
                      ? "bg-purple-600 dark:bg-cyan-400 dark:shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                      : "bg-transparent group-hover:bg-slate-500/30"
                  }`} />
                </button>

                {/* DESKTOP HOLOGRAPHIC MEGA MENU DROPDOWN */}
                <MegaMenu isOpen={isMegaMenuOpen} />
              </div>
            );
          }

          return (
            <Link
              key={index}
              href={item.href}
              className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 duration-200 relative group ${
                isActive
                  ? "text-purple-600 dark:text-cyan-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              }`}
            >
              {item.icon}
              <span>{item.name}</span>

              {/* Active/Hover Line */}
              <span className={`absolute -bottom-3.5 left-0 right-0 h-[2px] rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-purple-600 dark:bg-cyan-400 dark:shadow-[0_0_8px_rgba(34,211,238,0.5)]"
                  : "bg-transparent group-hover:bg-slate-500/30"
              }`} />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
