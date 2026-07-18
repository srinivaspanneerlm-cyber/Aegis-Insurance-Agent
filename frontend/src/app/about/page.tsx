"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useTheme } from "@/context/ThemeContext";
import { AmbientBackground } from "@/components/shared/AmbientBackground";
import {
  wrapperClass,
  AboutHero,
  AchievementsPanel,
  CompanyIntroCard,
  VisionMissionSection,
  WhyAegisSection,
  FounderLocationSection,
  CompanyValuesSection,
  RoadmapSection,
} from "@/components/about";

export default function AboutPage() {
  const { theme } = useTheme();

  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass(theme)}`}>
      <Navbar />
      <AmbientBackground variant="about" />
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
