"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { wrapperClass } from "@/components/about/aboutTheme";
import { AboutAmbientBackground } from "@/components/about/AboutAmbientBackground";
import { AboutHero } from "@/components/about/AboutHero";
import { AchievementsPanel } from "@/components/about/AchievementsPanel";
import { CompanyIntroCard } from "@/components/about/CompanyIntroCard";
import { VisionMissionSection } from "@/components/about/VisionMissionSection";
import { WhyAegisSection } from "@/components/about/WhyAegisSection";
import { FounderLocationSection } from "@/components/about/FounderLocationSection";
import { CompanyValuesSection } from "@/components/about/CompanyValuesSection";
import { RoadmapSection } from "@/components/about/RoadmapSection";

export default function AboutPage() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass(theme)}`}>
      <Navbar />
      <AboutAmbientBackground />
      <AboutHero />
      <AchievementsPanel />
      <CompanyIntroCard />
      <VisionMissionSection />
      <WhyAegisSection />
      <FounderLocationSection />
      <CompanyValuesSection />
      <RoadmapSection />
      <Footer />
    </div>
  );
}
