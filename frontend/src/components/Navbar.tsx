"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Shield, Sun, Moon, Search, User, LogOut,
  Home as HomeIcon, Package, Users as UsersIcon, UserCheck, PhoneCall,
  Car, Heart, Globe, Home as HomeIconSolid, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { useRouter, usePathname } from "next/navigation";

interface NavbarProps {
  onLoginClick?: () => void;
}

export default function Navbar({ onLoginClick }: NavbarProps) {
  const { isAuthenticated, logout, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  // Search bar states
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Mega dropdown menu state
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Theme-aware styles
  const navBgClass = theme === "dark"
    ? "bg-slate-950/75 border-b border-white/5 backdrop-blur-xl"
    : "bg-white/90 border-b border-slate-200/60 backdrop-blur-xl shadow-sm";

  const secondNavBgClass = theme === "dark"
    ? "bg-slate-900/50 border-t border-white/5"
    : "bg-slate-100/50 border-t border-slate-200/50";

  const brandTextClass = theme === "dark"
    ? "text-white"
    : "text-navy-900";

  const searchInputClass = theme === "dark"
    ? "bg-white/[0.04] border-white/10 text-white placeholder-slate-400 focus:bg-slate-900/80 focus:border-royal-400 focus:ring-1 focus:ring-royal-500/20"
    : "bg-slate-100 border-slate-200 text-slate-800 placeholder-slate-400 focus:bg-white focus:border-royal-650 focus:ring-4 focus:ring-royal-500/5";

  // Mega Menu Data structure
  const megaMenuCategories = [
    {
      title: "Motor Insurance",
      icon: <Car className="w-5 h-5" />,
      color: "text-cyan-400 border-cyan-400/20 bg-cyan-500/10",
      bot: "Alex",
      subcategories: [
        "Private Car", "Two Wheeler", "Passenger Carrying Vehicle", 
        "Goods Carrying Vehicle", "Miscellaneous Vehicle", "Commercial Vehicle"
      ]
    },
    {
      title: "Health Insurance",
      icon: <Heart className="w-5 h-5" />,
      color: "text-purple-400 border-purple-500/20 bg-purple-500/10",
      bot: "Sarah",
      subcategories: [
        "Individual Health Insurance", "Family Floater Insurance", "Senior Citizen Insurance", 
        "Critical Illness Insurance", "Maternity Insurance", "Group Health Insurance", 
        "Personal Accident Cover", "Top-Up Health Insurance", "Disease Specific Insurance", "Cashless Health Insurance"
      ]
    },
    {
      title: "Travel Insurance",
      icon: <Globe className="w-5 h-5" />,
      color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10",
      bot: "Ethan",
      subcategories: [
        "Domestic Travel Insurance", "International Travel Insurance", "Student Travel Insurance", 
        "Family Travel Insurance", "Business Travel Insurance", "Senior Citizen Travel Insurance", 
        "Single Trip Insurance", "Multi Trip Insurance"
      ]
    },
    {
      title: "Home & Property",
      icon: <HomeIconSolid className="w-5 h-5" />,
      color: "text-amber-400 border-amber-500/20 bg-amber-500/10",
      bot: "Emma",
      subcategories: [
        "Home Structure Insurance", "Home Content Insurance", "Property Insurance", 
        "Fire Insurance", "Natural Disaster Insurance", "Tenant Insurance", 
        "Landlord Insurance", "Office Property Insurance"
      ]
    },
    {
      title: "Miscellaneous",
      icon: <Shield className="w-5 h-5" />,
      color: "text-rose-400 border-rose-500/20 bg-rose-500/10",
      bot: "Alex",
      subcategories: [
        "Pet Insurance", "Cyber Insurance", "Mobile Insurance", 
        "Jewellery Insurance", "Crop Insurance", "Marine Insurance", 
        "Event Insurance", "Liability Insurance", "Electronic Equipment Insurance"
      ]
    }
  ];

  // Second navbar items
  const menuItems = [
    { name: "Home", href: "/", icon: <HomeIcon className="w-4 h-4" /> },
    { name: "Products", href: "/policies", icon: <Package className="w-4 h-4" />, isMega: true },
    { name: "About Us", href: "/about", icon: <UsersIcon className="w-4 h-4" /> },
    { name: "Agent Details", href: "/agents", icon: <UserCheck className="w-4 h-4" /> },
    { name: "Contact Us", href: "/contact", icon: <PhoneCall className="w-4 h-4" /> }
  ];

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${navBgClass}`}
    >
      {/* ROW 1: THE FOUR-ELEMENT TOP BAR */}
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between gap-4">
        
        {/* ITEM 1: AEGIS AI LOGO & BRANDING */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0">
          <div className="relative">
            <div className={`absolute inset-0 rounded-xl blur-md opacity-30 group-hover:opacity-50 transition-opacity ${
              theme === "dark" ? "bg-cyan-500" : "bg-royal-500"
            }`} />
            <div className={`relative w-10 h-10 rounded-xl flex items-center justify-center text-white border ${
              theme === "dark" 
                ? "bg-gradient-to-tr from-slate-900 to-cyan-500 border-white/10 shadow-[0_0_15px_rgba(6,182,212,0.3)]" 
                : "bg-gradient-to-tr from-navy-900 to-royal-600 border-white/20 shadow-sm"
            }`}>
              <Shield className={`w-5.5 h-5.5 stroke-[2] ${theme === "dark" ? "text-cyan-300" : "text-white"}`} />
            </div>
          </div>
          <div className="flex flex-col text-left">
            <span className={`text-lg font-black tracking-tight leading-none flex items-center gap-1 transition-colors duration-300 ${brandTextClass}`}>
              <span>Aegis</span> 
              <span className={theme === "dark" ? "text-cyan-400 font-extrabold" : "text-royal-650"}>AI</span>
            </span>
            <span className={`text-[8.5px] font-black tracking-widest uppercase mt-1 ${theme === "dark" ? "text-slate-500" : "text-slate-400"}`}>
              AI Insurance Advisor
            </span>
          </div>
        </Link>

        {/* ITEM 2: SEARCH BUTTON / INPUT WITH ⌘ K */}
        <form onSubmit={handleSearchSubmit} className="flex-grow max-w-md hidden md:block relative">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
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

        {/* RIGHT ZONE: THEME TOGGLE & LOGIN BUTTON */}
        <div className="flex items-center gap-5 flex-shrink-0">
          
          {/* ITEM 3: DARK/LIGHT THEME TOGGLE */}
          <button
            onClick={toggleTheme}
            className={`w-14 h-7 rounded-full p-0.5 transition-all duration-300 relative border flex items-center cursor-pointer shadow-inner ${
              theme === "dark" 
                ? "bg-slate-900 border-white/10" 
                : "bg-slate-100 border-slate-200"
            }`}
          >
            <motion.div
              layout
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-white border shadow-md ${
                theme === "dark"
                  ? "bg-gradient-to-tr from-cyan-600 to-blue-500 border-cyan-400/20 translate-x-7"
                  : "bg-gradient-to-tr from-amber-400 to-yellow-500 border-amber-300/20 translate-x-0"
              }`}
            >
              {theme === "dark" ? (
                <Moon className="w-3.5 h-3.5 text-cyan-200" />
              ) : (
                <Sun className="w-3.5 h-3.5 text-amber-950" />
              )}
            </motion.div>
          </button>

          {/* ITEM 4: DYNAMIC SECURE LOGIN BUTTON (Mockup design) */}
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link
                href={user?.role === "admin" ? "/admin" : "/dashboard"}
                className={`py-2 px-4 rounded-full text-xs font-black uppercase tracking-wider transition-all border ${
                  theme === "dark"
                    ? "bg-white/[0.03] border-cyan-400/30 text-cyan-300 hover:bg-white/[0.08]"
                    : "bg-slate-100 border-slate-250 text-royal-600 hover:bg-slate-200"
                }`}
              >
                <span>Console</span>
              </Link>
              
              <button
                onClick={logout}
                className={`flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider py-2 px-3.5 rounded-full border transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-white/5 border-white/10 text-slate-300 hover:text-rose-400"
                    : "bg-white border-slate-200 text-slate-600 hover:text-rose-600"
                }`}
              >
                <LogOut className="w-3.5 h-3.5 text-rose-500" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          ) : (
            <button
              onClick={onLoginClick}
              className={`flex items-center gap-2 text-xs font-black uppercase tracking-wider py-2 px-5 rounded-full border transition-all shadow-[0_4px_15px_rgba(168,85,247,0.25)] text-white cursor-pointer bg-gradient-to-r from-purple-600 to-indigo-650 border-purple-500/20 hover:from-purple-500 hover:to-indigo-550`}
            >
              <User className="w-4 h-4 stroke-[2.5]" />
              <span>Login</span>
            </button>
          )}

        </div>

      </div>

      {/* ROW 2: SECOND GLASSMORPHIC NAVIGATION BAR */}
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
                    className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 duration-200 relative group cursor-pointer bg-transparent border-0 outline-none ${
                      isActive 
                        ? theme === "dark" ? "text-cyan-400" : "text-purple-600"
                        : theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {item.icon}
                    <span>{item.name}</span>
                    
                    {/* Active/Hover Line */}
                    <span className={`absolute -bottom-3.5 left-0 right-0 h-[2px] rounded-full transition-all duration-300 ${
                      isActive || isMegaMenuOpen
                        ? theme === "dark" ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "bg-purple-600"
                        : "bg-transparent group-hover:bg-slate-500/30"
                    }`} />
                  </button>

                  {/* DESKTOP HOLOGRAPHIC MEGA MENU DROPDOWN */}
                  <AnimatePresence>
                    {isMegaMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        transition={{ duration: 0.25 }}
                        className={`absolute left-1/2 -translate-x-[45%] top-full mt-4 w-[90vw] max-w-6xl p-8 rounded-[36px] border text-left shadow-2xl backdrop-blur-3xl z-50 ${
                          theme === "dark"
                            ? "bg-slate-950/95 border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.6)]"
                            : "bg-white/95 border-slate-250/80 shadow-[0_20px_50px_rgba(0,0,0,0.08)]"
                        }`}
                      >
                        {/* Visual glow details */}
                        <div className="absolute top-0 left-1/4 w-40 h-40 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                        <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-stretch relative z-10">
                          {megaMenuCategories.map((cat, idx) => (
                            <div 
                              key={idx}
                              className={`p-5 rounded-3xl border flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] ${
                                theme === "dark"
                                  ? "bg-white/[0.01] border-white/5 hover:bg-white/[0.03] hover:border-cyan-400/25"
                                  : "bg-slate-50/50 border-slate-200/60 hover:bg-white hover:border-purple-400 shadow-sm"
                              }`}
                            >
                              <div>
                                {/* Header */}
                                <div className="flex items-center gap-2.5 mb-4">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${cat.color}`}>
                                    {cat.icon}
                                  </div>
                                  <h4 className={`text-xs font-black uppercase tracking-wider ${
                                    theme === "dark" ? "text-white" : "text-navy-900"
                                  }`}>
                                    {cat.title}
                                  </h4>
                                </div>

                                {/* Subcategories */}
                                <ul className="space-y-2 mb-6">
                                  {cat.subcategories.map((sub, sIdx) => (
                                    <li 
                                      key={sIdx}
                                      className={`text-[10.5px] font-semibold leading-relaxed flex items-center gap-1.5 transition-colors ${
                                        theme === "dark" ? "text-slate-400 hover:text-cyan-300" : "text-slate-600 hover:text-purple-600"
                                      }`}
                                    >
                                      <span className="w-1 h-1 rounded-full bg-slate-500" />
                                      <span>{sub}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Consultation Button */}
                              <Link
                                href={`/advisor?bot=${encodeURIComponent(cat.bot)}`}
                                className={`w-full py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-center flex items-center justify-center gap-1 shadow-sm border transition-all ${
                                  theme === "dark"
                                    ? "bg-cyan-500/10 border-cyan-400/20 text-cyan-300 hover:bg-cyan-500/20"
                                    : "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
                                }`}
                              >
                                <span>Talk With AI</span>
                                <ArrowRight className="w-3 h-3" />
                              </Link>

                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            return (
              <Link 
                key={index}
                href={item.href}
                className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest transition-all hover:scale-105 duration-200 relative group ${
                  isActive 
                    ? theme === "dark" ? "text-cyan-400" : "text-purple-600"
                    : theme === "dark" ? "text-slate-400 hover:text-slate-200" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {item.icon}
                <span>{item.name}</span>
                
                {/* Active/Hover Line */}
                <span className={`absolute -bottom-3.5 left-0 right-0 h-[2px] rounded-full transition-all duration-300 ${
                  isActive
                    ? theme === "dark" ? "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]" : "bg-purple-600"
                    : "bg-transparent group-hover:bg-slate-500/30"
                }`} />
              </Link>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
