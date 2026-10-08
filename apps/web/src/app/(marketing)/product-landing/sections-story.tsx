import { product } from "../data";
import { Chip, Container, Icon, Section, SectionHeading } from "./primitives";

type ProductFeature = (typeof product.features)[number];

const toneBar = (score: number) =>
  score >= 75 ? "bg-primary" : score >= 50 ? "bg-amber-400" : "bg-destructive";

const labelClass = "text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground";

function ChallengeVisual({ input, output }: {
  input: { label: string; content: string };
  output: { label: string; items: string[] };
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="border border-border bg-background/60 p-5">
        <p className={`mb-3 ${labelClass}`}>{input.label}</p>
        <p className="whitespace-pre-line font-mono text-[13px] leading-7 text-foreground/80">
          {input.content}
        </p>
      </div>
      <div className="border border-primary/20 p-5">
        <p className={`mb-3 ${labelClass}`}>{output.label}</p>
        <div className="flex flex-wrap gap-2">
          {output.items.map((item) => (
            <span
              key={item}
              className="border border-primary/25 px-2.5 py-1 font-mono text-xs text-primary"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreVisual({ categories, findings }: {
  categories: { name: string; score: number }[];
  findings: { severity: string; title: string }[];
}) {
  const overall = Math.round(
    categories.reduce((sum, c) => sum + c.score, 0) / categories.length,
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-6 lg:grid-cols-[200px_1fr] lg:items-center">
        <div className="flex flex-col gap-1 border border-primary/20 bg-background/60 p-6">
          <span className={labelClass}>Overall</span>
          <span className="font-mono text-6xl font-light tabular-nums text-foreground">
            {overall}
          </span>
          <span className="text-xs text-muted-foreground">out of 100</span>
        </div>

        <ul className="flex flex-col gap-4">
          {categories.map((c) => (
            <li
              key={c.name}
              className="grid grid-cols-[minmax(0,140px)_1fr_36px] items-center gap-4"
            >
              <span className="text-sm leading-5 text-muted-foreground">{c.name}</span>
              <div className="h-1.5 overflow-hidden bg-foreground/[0.06]">
                <div
                  className={`h-full ${toneBar(c.score)}`}
                  style={{ width: `${c.score}%` }}
                />
              </div>
              <span className="text-right font-mono text-sm tabular-nums text-foreground">
                {c.score}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <p className={labelClass}>Findings</p>
        <ul className="flex flex-col gap-2">
          {findings.map((f) => (
            <li
              key={f.title}
              className="flex items-start gap-3 border border-border/70 bg-background/50 p-3.5"
            >
              <Chip tone={f.severity === "critical" ? "danger" : "warning"} className="shrink-0 bg-transparent border-none">
                {f.severity}
              </Chip>
              <span className="text-sm leading-6 text-muted-foreground">{f.title}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FixesVisual({ fixes }: { fixes: { title: string; technology: string }[] }) {
  return (
    <ul className="grid flex-1 auto-rows-fr gap-2">
      {fixes.map((fix) => (
        <li
          key={fix.title}
          className="flex items-center justify-between gap-3 border border-border/70 bg-background/50 px-4 py-3 transition-colors"
        >
          <div className="flex min-w-0 items-center gap-3">
            <span className="text-sm leading-5 text-foreground">{fix.title}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function PathVisual({ before, request, migration }: {
  before: string[];
  request: string;
  migration: { phase: string; steps: string[] }[];
}) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2 border border-dashed border-border p-4">
        {before.map((tech) => (
          <Chip key={tech}>{tech}</Chip>
        ))}
        <Icon name="arrow-right" className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-mono text-[12.5px] text-muted-foreground">{request}</span>
      </div>

      <ol className="grid flex-1 auto-rows-fr gap-4 md:grid-cols-3">
        {migration.map((phase, i) => (
          <li
            key={phase.phase}
            className="flex flex-col gap-4 border border-border/70 bg-background/50 p-5"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-muted-foreground">0{i + 1}</span>
              <span className="text-sm font-medium text-foreground">{phase.phase}</span>
            </div>
            <div className="flex gap-1.5" aria-hidden="true">
              {[0, 1, 2].map((level) => (
                <span
                  key={level}
                  className={`h-1 flex-1 ${level <= i ? "bg-primary" : "bg-foreground/10"}`}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-2">
              {phase.steps.map((step) => (
                <li key={step} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="size-1.5 shrink-0 bg-primary/60" />
                  {step}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FeatureVisual({ feature }: { feature: ProductFeature }) {
  if (feature.input && feature.output) {
    return <ChallengeVisual input={feature.input} output={feature.output} />;
  }
  if (feature.score && feature.findings) {
    return <ScoreVisual categories={feature.score.categories} findings={feature.findings} />;
  }
  if (feature.fixes) {
    return <FixesVisual fixes={feature.fixes} />;
  }
  if (feature.before && feature.request && feature.migration) {
    return (
      <PathVisual
        before={feature.before}
        request={feature.request}
        migration={feature.migration}
      />
    );
  }
  return null;
}

function BentoCard({ feature, className = "" }: { feature: ProductFeature; className?: string }) {
  return (
    <article
      className={`group relative flex flex-col overflow-hidden bg-background p-6 transition-colors duration-500 md:p-8 ${className}`}
    >
      <div className="relative flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <span className="font-mono text-xs text-muted-foreground">{feature.number}</span>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-xl font-medium tracking-tight text-foreground md:text-2xl">
            {feature.title}
          </h3>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            {feature.description}
          </p>
        </div>
      </div>

      <div className="relative mt-8 flex flex-1 flex-col">
        <FeatureVisual feature={feature} />
      </div>
    </article>
  );
}

const bentoPlacement: Record<string, string> = {
  write: "lg:col-start-1 lg:row-start-1",
  score: "order-first md:col-span-2 lg:order-none lg:col-span-2 lg:col-start-2 lg:row-start-1",
  fixes: "lg:col-start-4 lg:row-start-1",
  path: "md:col-span-2 lg:col-span-4 lg:col-start-1 lg:row-start-2",
};

export function ProductDemoSection() {
  return (
    <Section id={product.id}>
      <span id="how-it-works" className="sr-only" aria-hidden="true" />

      <Container>
        <SectionHeading
          eyebrow={product.eyebrow}
          title={product.title}
          description={product.description}
        />

        <div className="mt-14 grid gap-px border border-border bg-border md:grid-cols-2 lg:mt-20 lg:grid-cols-4">
          {product.features.map((feature) => (
            <BentoCard
              key={feature.id}
              feature={feature}
              className={bentoPlacement[feature.id] ?? ""}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
