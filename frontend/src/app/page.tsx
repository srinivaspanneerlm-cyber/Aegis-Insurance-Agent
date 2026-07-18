"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Testimonials from "@/components/Testimonials";
import { useTheme } from "@/context/ThemeContext";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import { HeroSection, StatsBar, AdvisorEcosystem, LoginModal } from "@/components/home";

export default function Home() {
  const { theme } = useTheme();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const openLogin = () => setIsLoginOpen(true);

  const wrapperClass = theme === "dark" ? "bg-slate-950 text-white" : "bg-slate-50 text-navy-900";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar onLoginClick={openLogin} />
      <AmbientBackground variant="home" />
      <HeroSection onOpenLogin={openLogin} />
      <StatsBar />
      <AdvisorEcosystem />
      <Testimonials />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      <Footer />
    </div>
  );
}
