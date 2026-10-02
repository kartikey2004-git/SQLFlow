import { product } from "../data";
import { ArchitectureGraph } from "./graph";
import {
  Chip,
  Container,
  Icon,
  Panel,
  ScoreBar,
  Section,
  SectionHeading,
  StatTile,
} from "./primitives";

type ProductFeature = (typeof product.features)[number];

function FeatureStatusChip({ status }: { status: ProductFeature["status"] }) {
  return status === "shipped" ? (
    <Chip tone="success" className="bg-transparent border-none">
      Shipped
    </Chip>
  ) : (
    <Chip tone="neutral" className="bg-transparent border-none">
      Planned
    </Chip>
  );
}

function FeatureVisual({ feature }: { feature: ProductFeature }) {
  if ("input" in feature && "output" in feature) {
    const f = feature as typeof feature & {
      input: { label: string; content: string };
      output: { label: string; items: string[] };
    };
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <Panel className="flex-1 border-dashed bg-transparent p-4 backdrop-blur-none">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {f.input.label}
          </p>
          <p className="font-mono text-[12.5px] leading-relaxed text-muted-foreground">
            {f.input.content}
          </p>
        </Panel>
        <div className="flex items-center justify-center py-1 sm:py-0">
          <Icon
            name="arrow-right"
            className="size-5 shrink-0 rotate-90 text-muted-foreground sm:rotate-0"
          />
        </div>
        <Panel className="flex-1 border-dashed bg-transparent p-4 backdrop-blur-none">
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            {f.output.label}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {f.output.items.map((item) => (
              <Chip key={item} className="rounded-none border-none">{item}</Chip>
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  if ("score" in feature) {
    const f = feature as typeof feature & {
      score: { categories: { name: string; score: number }[] };
      findings: { severity: string; title: string }[];
    };
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {f.score.categories.map((category) => (
              <ScoreBar
                key={category.name}
                label={category.name}
                score={category.score}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Findings
          </p>

          <ul className="flex flex-col gap-2.5 -ml-5">
            {f.findings.map((finding) => (
              <li
                key={finding.title}
                className="grid grid-cols-[90px_minmax(0,1fr)] items-center gap-3 text-sm"
              >
                <Chip
                  tone={finding.severity === "critical" ? "danger" : "warning"}
                  className="w-[90px] justify-center border-none bg-transparent px-0"
                >
                  {finding.severity}
                </Chip>

                <span className="min-w-0 leading-5 text-muted-foreground">
                  {finding.title}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  if ("fixes" in feature) {
    const f = feature as typeof feature & {
      fixes: { title: string; technology: string }[];
    };
    return (
      <ul className="grid gap-2 sm:grid-cols-2">
        {f.fixes.map((fix) => (
          <li
            key={fix.title}
            className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-transparent px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Icon
                name="check-circle"
                className="size-4 shrink-0 text-emerald-400"
              />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-foreground">
                  {fix.title}
                </span>
                <span className="text-xs text-muted-foreground">
                  {fix.technology}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if ("before" in feature) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          {feature.before.map((tech) => (
            <Chip key={tech}>{tech}</Chip>
          ))}
          <Icon
            name="arrow-right"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <span className="font-mono text-[12.5px] text-muted-foreground">
            {feature.request}
          </span>
        </div>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {feature.migration.map((phase) => (
            <li
              key={phase.phase}
              className="rounded-xl border border-dashed border-border bg-transparent p-4"
            >
              <p className="mb-1.5 text-xs font-medium text-primary">
                {phase.phase}
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {phase.steps.join(" · ")}
              </p>
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return null;
}

function WorkflowPanel({ feature }: { feature: ProductFeature }) {
  return (
    <Panel className="flex h-[560px] w-[560px] flex-col gap-6 overflow-y-auto p-6 backdrop-blur-none md:w-[720px] md:p-9">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Icon name={feature.icon} className="size-4 text-primary" />
          <span className="font-mono text-xs text-muted-foreground">
            {feature.number}
          </span>
          <FeatureStatusChip status={feature.status} />
        </div>
        <h3 className="text-lg font-medium text-foreground md:text-xl">
          {feature.title}
        </h3>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {feature.description}
        </p>
      </div>

      <FeatureVisual feature={feature} />
    </Panel>
  );
}

export function ProductDemoSection() {
  const features = [...product.features, ...product.features];

  return (
    <Section id={product.id} className="border-t border-border">
      <span id="how-it-works" className="sr-only" aria-hidden="true" />

      <Container>
        <SectionHeading
          eyebrow={product.eyebrow}
          title={product.title}
          description={product.description}
        />
      </Container>

      <div className="mt-14 overflow-hidden lg:mt-20">
        <div className="flex w-max animate-infinite-scroll gap-6 px-4 md:px-10 lg:px-14">
          {features.map((feature, index) => (
            <WorkflowPanel
              key={`${feature.id}-${index}`}
              feature={feature}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}