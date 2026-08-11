"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

/** Global search input with a ⌘K/Ctrl-K focus shortcut; routes to /policies. */
export function SearchBar() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Listen to keyboard shortcut ⌘ K or Ctrl K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/policies?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const searchInputClass = "bg-slate-100 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-royal-650 focus:ring-4 focus:ring-royal-500/5 dark:bg-white/[0.04] dark:border-white/10 dark:text-white dark:placeholder-slate-400 dark:focus:bg-slate-900/80 dark:focus:border-royal-400 dark:focus:ring-1 dark:focus:ring-royal-500/20";

  return (
    <form onSubmit={handleSearchSubmit} className="flex-grow max-w-md hidden md:block relative">
      <div className="relative">
        <input
          ref={searchInputRef}
          type="text"
          aria-label="Search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search anything..."
          className={`w-full py-2 pl-10 pr-14 rounded-full text-xs font-semibold outline-none transition-all ${searchInputClass}`}
        />
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

        {/* ⌘ K Indicator */}
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-[9px] font-bold text-slate-500 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md pointer-events-none">
          <span>⌘</span>
          <span>K</span>
        </div>
      </div>
    </form>
  );
}
