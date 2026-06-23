"use client";

import { useState } from "react";
import { Star, MessageSquare, Heart, Car, Plane, Home as HomeIcon, Shield, Sparkles, User } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "@/context/ThemeContext";

interface TestimonialItem {
  name: string;
  category: string;
  categoryIcon: React.ReactNode;
  advisor: string;
  rating: number;
  feedback: string;
  avatarBg: string;
}

export default function Testimonials() {
  const { theme } = useTheme();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const testimonials: TestimonialItem[] = [
    {
      name: "Arun Kumar",
      category: "Health Insurance User",
      categoryIcon: <Heart className="w-3.5 h-3.5 text-rose-500" />,
      advisor: "Sarah AI",
      rating: 5,
      feedback: "The AI advisor explained family insurance more clearly than any traditional agent.",
      avatarBg: "from-rose-500/20 to-purple-650/20"
    },
    {
      name: "Vignesh R",
      category: "Motor Insurance User",
      categoryIcon: <Car className="w-3.5 h-3.5 text-cyan-500" />,
      advisor: "Alex AI",
      rating: 5,
      feedback: "Alex AI helped me select the perfect motor insurance plan within minutes.",
      avatarBg: "from-cyan-500/20 to-indigo-500/20"
    },
    {
      name: "Priya S",
      category: "Travel Insurance User",
      categoryIcon: <Plane className="w-3.5 h-3.5 text-emerald-500" />,
      advisor: "Ethan AI",
      rating: 5,
      feedback: "The AI consultation experience felt futuristic and extremely personalized.",
      avatarBg: "from-emerald-500/20 to-teal-500/20"
    },
    {
      name: "Kavya M",
      category: "Property Insurance User",
      categoryIcon: <HomeIcon className="w-3.5 h-3.5 text-purple-500" />,
      advisor: "Emma AI",
      rating: 5,
      feedback: "I finally understood insurance properly because of the AI conversation system.",
      avatarBg: "from-purple-500/20 to-pink-500/20"
    },
    {
      name: "Sivamaran J",
      category: "Chief AI Advisor",
      categoryIcon: <Shield className="w-3.5 h-3.5 text-cyan-400" />,
      advisor: "Sri AI",
      rating: 5,
      feedback: "Executing automated risk-checks with Sri AI saved hours of paperwork.",
      avatarBg: "from-cyan-400/20 to-purple-500/20"
    }
  ];

  // Double testimonials array to ensure smooth infinite marquee scroll
  const scrollTestimonials = [...testimonials, ...testimonials];

  const lightModeClass = "bg-white/80 border-slate-200/80 shadow-xl text-slate-800";
  const darkModeClass = "bg-slate-900/60 border-white/5 shadow-2xl text-white";

  return (
    <section className="relative py-24 overflow-hidden z-10">
      
      {/* Holographic ambient background lights */}
      {theme === "dark" ? (
        <>
          <div className="absolute top-[30%] left-[20%] w-[50%] h-[50%] rounded-full bg-purple-650/5 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[20%] right-[10%] w-[45%] h-[45%] rounded-full bg-cyan-500/5 blur-[110px] pointer-events-none" />
        </>
      ) : (
        <>
          <div className="absolute top-[30%] left-[10%] w-[40%] h-[40%] rounded-full bg-royal-100/30 blur-[90px] pointer-events-none" />
        </>
      )}

      <div className="max-w-7xl w-full mx-auto px-6 mb-16 text-center">
        
        {/* Cinematic Header */}
        <div className="space-y-4">
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className={`inline-flex items-center gap-1.5 py-1 px-3.5 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
              theme === "dark" 
                ? "bg-purple-950/30 border-purple-500/20 text-purple-400" 
                : "bg-purple-50 border-purple-100 text-purple-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>AI Trust Network</span>
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className={`text-3xl sm:text-5xl font-black tracking-tight leading-tight ${
              theme === "dark" ? "text-white" : "text-navy-950"
            }`}
          >
            Trusted by Thousands of{" "}
            <span className="bg-gradient-to-r from-purple-500 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              AI-Guided Users
            </span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 text-xs sm:text-sm font-semibold max-w-xl mx-auto leading-relaxed"
          >
            Real people are discovering optimized, transparent coverage and bypassing traditional agent cold calls completely.
          </motion.p>
        </div>
      </div>

      {/* INFINITE SCROLL CAROUSEL MARQUEE */}
      <div className="w-full relative flex items-center overflow-hidden py-8">
        
        {/* Left & Right cinematic blur fading overlays */}
        <div className={`absolute left-0 top-0 bottom-0 w-32 z-20 pointer-events-none bg-gradient-to-r ${
          theme === "dark" ? "from-slate-950 to-transparent" : "from-slate-50 to-transparent"
        }`} />
        <div className={`absolute right-0 top-0 bottom-0 w-32 z-20 pointer-events-none bg-gradient-to-l ${
          theme === "dark" ? "from-slate-950 to-transparent" : "from-slate-50 to-transparent"
        }`} />

        <div className="flex w-[200%] gap-6 animate-marquee hover:[animation-play-state:paused] whitespace-nowrap">
          {scrollTestimonials.map((item, idx) => {
            const isHovered = hoveredIdx === idx;
            return (
              <motion.div
                key={idx}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                // Cinematic bobbing animation
                animate={{
                  y: idx % 2 === 0 ? [0, -5, 0] : [0, 5, 0]
                }}
                transition={{
                  repeat: Infinity,
                  duration: idx % 2 === 0 ? 5 : 6,
                  ease: "easeInOut"
                }}
                className={`w-[320px] sm:w-[380px] p-6 sm:p-8 rounded-[32px] border backdrop-blur-xl shrink-0 text-left transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${
                  theme === "dark" ? darkModeClass : lightModeClass
                } ${
                  isHovered 
                    ? theme === "dark"
                      ? "border-purple-500/40 shadow-[0_0_40px_rgba(168,85,247,0.15)] scale-[1.02]"
                      : "border-purple-400/40 shadow-2xl scale-[1.02]"
                    : ""
                }`}
              >
                {/* Holographic shifting radial glow on hover */}
                {theme === "dark" && (
                  <div className={`absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.06)_0%,transparent_70%)] transition-opacity duration-300 pointer-events-none ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`} />
                )}

                <div className="space-y-6 relative z-10">
                  {/* Category & Ratings header */}
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                        theme === "dark" ? "bg-white/5" : "bg-slate-100"
                      }`}>
                        {item.categoryIcon}
                      </div>
                      <span className={`text-[9.5px] font-black uppercase tracking-wider ${
                        theme === "dark" ? "text-slate-350" : "text-slate-650"
                      }`}>
                        {item.category}
                      </span>
                    </div>

                    {/* Star Rating */}
                    <div className="flex items-center gap-0.5">
                      {[...Array(item.rating)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-amber-450 text-amber-450" />
                      ))}
                    </div>
                  </div>

                  {/* Customer Feedback */}
                  <p className={`text-xs sm:text-sm font-semibold leading-relaxed ${
                    theme === "dark" ? "text-slate-300" : "text-slate-700"
                  } whitespace-normal`}>
                    &ldquo;{item.feedback}&rdquo;
                  </p>
                </div>

                {/* Advisor & User Info Footer */}
                <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between relative z-10">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-tr ${item.avatarBg} flex items-center justify-center border border-white/5 text-purple-400 font-black text-xs`}>
                      {item.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-white">{item.name}</h4>
                      <span className="inline-flex items-center gap-1 text-[8.5px] font-bold text-slate-500 mt-0.5">
                        <User className="w-3 h-3 text-purple-400" />
                        <span>Verified User</span>
                      </span>
                    </div>
                  </div>

                  {/* Advisor Consultation Tag */}
                  <span className={`py-1.5 px-3 rounded-xl text-[9px] font-black uppercase tracking-wider border flex items-center gap-1.5 transition-all ${
                    theme === "dark" 
                      ? "bg-purple-950/40 border-purple-500/20 text-purple-300" 
                      : "bg-purple-50 border-purple-100 text-purple-800"
                  }`}>
                    <span>🤖</span>
                    <span>{item.advisor}</span>
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Styled animation keyframes inside dynamic global style */}
      <style jsx global>{`
        @keyframes marquee {
          0% {
            transform: translateX(0%);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-marquee {
          animation: marquee 30s linear infinite;
        }
      `}</style>

    </section>
  );
}
