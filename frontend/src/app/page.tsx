"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Testimonials from "@/components/Testimonials";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import { HeroSection, StatsBar, AdvisorEcosystem, LoginModal, VoiceGreeting } from "@/components/home";

export default function Home() {
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const openLogin = () => setIsLoginOpen(true);

  const wrapperClass = "bg-surface text-content";

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar onLoginClick={openLogin} />
      <AmbientBackground variant="home" />
      <main id="main-content">
      <HeroSection onOpenLogin={openLogin} />
      <StatsBar />
      <AdvisorEcosystem />
      <Testimonials />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} />
      </main>
      <Footer />
      <VoiceGreeting />
    </div>
  );
}
