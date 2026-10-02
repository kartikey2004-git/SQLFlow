import { Button } from "@sql-learn/ui/components/button";
import { cn } from "@sql-learn/ui/lib/utils";
import { finalCta, roadmap, waitlist } from "../data";
import { WAITLIST_FORM_URL } from "../data/conversion/waitlist";
import {
  Chip,
  Container,
  DotBackdrop,
  Icon,
  Panel,
  Section,
  SectionHeading,
} from "./primitives";

const roadmapTone: Record<string, "accent" | "neutral"> = {
  current: "accent",
  planned: "neutral",
  future: "neutral",
};

export function RoadmapSection() {
  return (
    <Section id="roadmap" className="border-t border-border" density="tight">
      <Container className="flex flex-col gap-14">
        <SectionHeading
          eyebrow={roadmap.eyebrow}
          title={roadmap.title}
          description={roadmap.description}
          size="compact"
        />

        <div className="grid overflow-hidden border border-border sm:grid-cols-2 lg:grid-cols-4 [&>*]:-ml-px [&>*]:-mt-px">
          {roadmap.phases.map((phase) => {
            const isCurrent = phase.status === "current";

            return (
              <Panel
                key={phase.version}
                emphasis={isCurrent}
                className="flex flex-col gap-4 p-6"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "size-2 shrink-0 rounded-full",
                        isCurrent ? "bg-primary" : "bg-muted-foreground/40",
                      )}
                    />
                    <span className="font-mono text-xs text-muted-foreground">
                      {phase.version}
                    </span>
                  </div>
                  <Chip tone={roadmapTone[phase.status] ?? "neutral"}>
                    {phase.status}
                  </Chip>
                </div>

                <h3
                  className={cn(
                    "font-medium text-foreground",
                    isCurrent ? "text-lg" : "text-base",
                  )}
                >
                  {phase.title}
                </h3>

                <div className="flex flex-col gap-1.5 border-t border-border pt-3">
                  {phase.features.map((feature) => (
                    <p key={feature} className="text-xs text-muted-foreground">
                      {feature}
                    </p>
                  ))}
                </div>
              </Panel>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}

export function FinalCtaSection() {
  return (
    <Section id={waitlist.id} className="border-t border-border" density="feature">
      <DotBackdrop className="-z-10 opacity-60" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center"
      >
        <div className="size-[520px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <Container className="relative z-0">
        <Panel emphasis className="flex flex-col items-center gap-8 border-none px-6 py-16 text-center md:px-16 md:py-20">
          <SectionHeading
            eyebrow={waitlist.eyebrow}
            title={waitlist.title}
            description={waitlist.description}
            size="lg"
          />

          <Button asChild size="lg" className="rounded-none bg-primary px-8 text-white hover:bg-primary/90">
            <a href={WAITLIST_FORM_URL} target="_blank" rel="noopener noreferrer">
              {waitlist.submitLabel}
              <Icon name="arrow-right" className="size-4" />
            </a>
          </Button>

          <p className="text-xs text-muted-foreground">{waitlist.privacyNote}</p>

          <div className="flex flex-wrap items-center justify-center gap-3 border-t border-border pt-7">
            <span className="text-sm text-muted-foreground">{finalCta.description}</span>
          </div>
        </Panel>
      </Container>
    </Section>
  );
}
