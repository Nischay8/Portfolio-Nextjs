import { AboutSection } from "./sections/AboutSection";
import { HeroSection } from "./sections/HeroSection";
import { TestimonialsSection } from "./sections/TestimonialsSection";
import { SkillsSection } from "./sections/SkillsSection";

async function PortfolioContent() {
  return (
    <>
      <HeroSection />
      <AboutSection />
      <TestimonialsSection />
      <SkillsSection />
    </>
  );
}

export default PortfolioContent;
