import "./(marketing)/product-landing/effects.css";
import {
  MarketingBackground,
  MarketingNavigation,
  Hero,
  ProductDemoSection,
  ArchitectureEngineSection,
  ReadinessScoreSection,
  UseCasesSection,
  DevelopersSection,
  MarketingFooter,
} from "./(marketing)/product-landing";

export default function Home() {
  return (
    <div className="mkt-landing min-h-screen bg-background text-foreground">
      <MarketingBackground />
      <MarketingNavigation />
      <main>
        <Hero />
        <ProductDemoSection />
        <ArchitectureEngineSection />
        <ReadinessScoreSection />
        <UseCasesSection />
        <DevelopersSection />
      </main>
      <MarketingFooter />
    </div>
  );
}
