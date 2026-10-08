import { Button } from "@sql-learn/ui/components/button";
import { hero, heroStats, problem, solution, supportedStack } from "../data";
import { AuthGuardLink } from "@/components/auth/auth-guard-link";
import { HashLink } from "./hash-link";
import {
  Container,
  Divider,
  DotBackdrop,
  Eyebrow,
  FeatureTile,
  GridBackdrop,
  Icon,
  Marquee,
  Panel,
  Section,
  SectionHeading,
} from "./primitives";
import { ArchitectureGraph } from "./graph";
import { SqlVisual } from "./architecture-visual";

export function Hero() {
  const technologies = supportedStack.categories.flatMap((category) =>
    category.technologies.map((technology) => technology.name),
  );

  return (
    <Section
      id="problem"
      className="relative -mt-10 overflow-hidden pb-16 pt-14 md:-mt-14 md:pb-20 md:pt-16"
    >
      <GridBackdrop className="opacity-40" />

      <Container className="relative grid min-h-[70vh] items-center gap-14 lg:min-h-[78vh] lg:grid-cols-[0.9fr_1fr] lg:gap-16 xl:gap-20">
        <div className="flex flex-col items-start gap-7">
          <Eyebrow>{hero.eyebrow.label}</Eyebrow>

          <h1 className="text-balance text-3xl leading-[1.08] tracking-tight text-foreground md:text-4xl lg:text-5xl">
            {hero.headline.line1}{" "}
            <span className="text-primary">{hero.headline.highlight}</span>{" "}
            {hero.headline.line3}
          </h1>

          <p className="max-w-[50ch] text-balance text-sm leading-relaxed text-muted-foreground md:text-base">
            {hero.description}
          </p>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="rounded-none bg-primary px-6 text-white hover:bg-primary/90">
                <AuthGuardLink href="/assignments">
                  {hero.primaryCta.label}
                </AuthGuardLink>
              </Button>

              <Button asChild variant="ghost" size="lg" className="rounded-none text-muted-foreground hover:bg-white/5 hover:text-foreground">
                <HashLink href={hero.secondaryCta.href}>
                  {hero.secondaryCta.label}
                </HashLink>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {hero.trustText}
            </p>
          </div>

          <div className="grid w-full grid-cols-3 gap-4 border-t border-border pt-7">
            {heroStats.map((stat) => (
              <div key={stat.value} className="flex flex-col gap-1">
                <span className="font-mono text-xs text-primary">
                  {stat.value}
                </span>

                <span className="text-xs text-muted-foreground md:text-sm">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <Panel className="relative h-full min-h-[380px] overflow-hidden md:min-h-[480px] lg:min-h-[560px] background-transparent border-none">
          <DotBackdrop className="absolute inset-0 opacity-30" />
          <SqlVisual />
        </Panel>
      </Container>

      <Container className="relative mt-20 flex flex-col items-center md:mt-28">
        <SectionHeading
          eyebrow={problem.eyebrow}
          title={problem.title}
          description={problem.description}
          size="lg"
        />
      </Container>

      <Container className="relative mt-14 md:mt-16">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {problem.painPoints.map((point) => (
            <FeatureTile
              key={point.title}
              icon={point.icon}
              title={point.title}
              description={point.description}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
