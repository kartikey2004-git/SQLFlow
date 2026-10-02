import { decisionEngine, developerExperience, useCases } from "../data";
import {
  Container,
  Eyebrow,
  FeatureTile,
  Panel,
  Section,
  SectionHeading,
} from "./primitives";

export function UseCasesSection() {
  return (
    <Section id={useCases.id} className="border-t border-border">
      <Container className="flex flex-col gap-16">
        <SectionHeading eyebrow={useCases.eyebrow} title={useCases.title} />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {useCases.items.map((item) => (
            <FeatureTile
              key={item.title}
              icon={item.icon}
              title={item.title}
              description={item.description}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}

export function DevelopersSection() {
  return (
    <Section
      id={developerExperience.id}
      className="border-t border-border"
      density="feature"
    >
      <Container size="wide">
        <SectionHeading
          align="left"
          eyebrow={developerExperience.eyebrow}
          title={developerExperience.title}
          description={developerExperience.description}
          size="lg"
          maxWidth="wide"
        />

        <div className="mt-14 grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LEFT */}
          <div className="flex flex-col gap-9">
            {developerExperience.principles.map((principle, index) => (
              <div
                key={principle.title}
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-4"
              >
                <span className="pt-0.5 font-mono text-xs text-muted-foreground">
                  {String(index + 1).padStart(2, "0")}
                </span>

                <div className="flex flex-col gap-1.5">
                  <h3 className="text-base font-medium leading-5 text-foreground">
                    {principle.title}
                  </h3>

                  <p className="text-sm leading-5 text-muted-foreground">
                    {principle.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT */}
          <div className="flex flex-col lg:-mt-56">
            <div className="flex flex-col gap-2">
              <Eyebrow><p className="p-2">{decisionEngine.eyebrow}</p></Eyebrow>

              <h3 className="text-lg font-semibold leading-snug text-foreground md:text-xl mb-6 mt-4">
                {decisionEngine.title}
              </h3>
            </div>

            <div className="flex flex-col gap-3">
              {decisionEngine.decisions.map((decision) => (
                <Panel
                  key={decision.capability}
                  className="flex min-h-[82px] flex-col justify-center gap-2.5 p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {decision.capability}
                    </span>

                    <span className="inline-flex items-center rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary">
                      {decision.decision}
                    </span>
                  </div>

                  <p className="text-sm leading-5 text-muted-foreground">
                    {decision.reason}
                  </p>
                </Panel>
              ))}
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
