"use client";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
  return (
    <div className={`min-h-screen relative flex flex-col justify-between overflow-hidden transition-colors duration-300 ${wrapperClass}`}>
      <Navbar />
      <AmbientBackground variant="about" />
      <main id="main-content">
      <AboutHero />
      <AchievementsPanel />
      <CompanyIntroCard />
      <VisionMissionSection />
      <WhyAegisSection />
      <FounderLocationSection />
      <CompanyValuesSection />
      <RoadmapSection />
      </main>
      <Footer />
    </div>
  );
}
