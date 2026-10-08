import type { ReactNode } from "react";
import {
  architectureChange,
  architectureGraph,
  comparison,
  compiler,
  deterministicEngine,
  github,
  solution,
  validation,
} from "../data";
import { HashLink } from "./hash-link";
import {
  Chip,
  Container,
  GraphScroller,
  Icon,
  Section,
  SectionHeading,
  StatusDot,
} from "./primitives";

const capabilityIcons: Record<string, string> = {
  "Dependency awareness": "git-branch",
  "Impact analysis": "activity",
  "Compatibility validation": "shield-check",
  "Architecture visualization": "network",
};

const layerIcons: Record<string, string> = {
  Intelligence: "sparkles",
  "Architecture Engine": "network",
  Executors: "wrench",
};

function EngineCell({
  icon,
  index,
  title,
  description,
  className = "",
  children,
}: {
  icon: string;
  index: string;
  title: string;
  description: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <article
      className={`group relative flex flex-col gap-6 bg-background p-6 transition-colors duration-300 md:p-8 ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-500 group-hover:scale-x-100"
      />

      <div className="flex items-start justify-between gap-4">
        <span className="flex size-9 items-center justify-center border border-primary/25 text-primary">
          <Icon name={icon} className="size-4" />
        </span>
        <span className="font-mono text-xs text-muted-foreground">{index}</span>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-medium tracking-tight text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>

      {children ? <div className="mt-auto flex flex-col gap-4">{children}</div> : null}
    </article>
  );
}

export function ArchitectureEngineSection() {
  const placement = [
    "lg:col-start-3 lg:row-start-1",
    "lg:col-start-4 lg:row-start-1",
    "lg:col-start-3 lg:row-start-2",
    "lg:col-start-4 lg:row-start-2",
  ];
  const layerPlacement = [
    "lg:col-start-1 lg:row-start-3",
    "lg:col-start-2 lg:row-start-3",
    "sm:col-span-2 lg:col-span-1 lg:col-start-3 lg:row-start-3",
  ];

  return (
    <Section id={architectureGraph.id} density="feature">
      <Container size="wide" className="flex flex-col gap-14 lg:gap-16">
        <SectionHeading
          eyebrow={compiler.eyebrow}
          title={compiler.title}
          description={compiler.description}
          size="lg"
        />

        <div className="grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <EngineCell
            icon="shield-check"
            index={`${validation.pipeline.length} gates`}
            title={validation.title}
            description={validation.description}
            className="sm:col-span-2 lg:col-span-2 lg:row-span-2 lg:col-start-1 lg:row-start-1 md:p-10"
          >
            <div className="grid gap-8 lg:grid-cols-[1.25fr_1fr]">
              <div className="flex flex-col">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Pipeline
                </p>
                <ol className="mt-4 flex flex-col">
                  {validation.pipeline.map((item, i) => {
                    const isLast = i === validation.pipeline.length - 1;
                    return (
                      <li key={item.step} className="relative flex items-center gap-4 pb-3 last:pb-0">
                        {!isLast ? (
                          <span
                            aria-hidden="true"
                            className="absolute bottom-0 left-[15px] top-8 w-px bg-primary/30"
                          />
                        ) : null}
                        <span
                          className={`relative flex size-8 shrink-0 items-center justify-center border font-mono text-[11px] ${
                            isLast
                              ? "border-primary bg-primary text-background"
                              : "border-primary/40 bg-background text-primary"
                          }`}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="flex-1 border border-border/70 bg-background px-4 py-2.5 text-sm text-foreground">
                          {item.step}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>

              <div className="flex flex-col border border-dashed border-primary/30 p-5">
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {validation.failureLoop.title}
                </p>
                <ol className="mt-4 grid grid-cols-2 gap-px border border-border bg-border">
                  {validation.failureLoop.steps.map((step, i) => (
                    <li key={step} className="flex flex-col gap-2 bg-background px-3 py-4">
                      <span className="font-mono text-[11px] text-primary">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="text-xs leading-5 text-foreground">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </EngineCell>

          {architectureGraph.capabilities.map((cap, i) => (
            <EngineCell
              key={cap.title}
              icon={capabilityIcons[cap.title] ?? "sparkles"}
              index={String(i + 1).padStart(2, "0")}
              title={cap.title}
              description={cap.description}
              className={placement[i] ?? ""}
            />
          ))}

          {deterministicEngine.layers.map((layer, i) => (
            <EngineCell
              key={layer.title}
              icon={layerIcons[layer.title] ?? "layers"}
              index={layer.number}
              title={layer.title}
              description={layer.description}
              className={layerPlacement[i] ?? ""}
            >
              <ul className="grid grid-cols-2 gap-px border border-border bg-border">
                {layer.components.map((component) => (
                  <li
                    key={component}
                    className="bg-background px-3 py-2 font-mono text-[11px] text-muted-foreground"
                  >
                    {component}
                  </li>
                ))}
              </ul>
            </EngineCell>
          ))}

          <EngineCell
            icon="cpu"
            index="UI"
            title="An interactive architecture workbench"
            description="Nodes for every dependency, a floating action toolbar, and collapsible panels for the YAML source and the generated file tree."
            className="sm:col-span-2 lg:col-span-1 lg:col-start-4 lg:row-start-3"
          >
            <div aria-hidden="true" className="grid grid-cols-3 gap-px border border-border bg-border">
              {["Nodes", "Toolbar", "Panels"].map((label) => (
                <span
                  key={label}
                  className="bg-background px-3 py-4 font-mono text-[11px] text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
          </EngineCell>
        </div>
      </Container>
    </Section>
  );
}

const archonStatusTone = {
  shipped: "success",
  planned: "neutral",
} as const;

function CapabilityCell({
  value,
  rowLabel,
  columnName,
}: {
  value: boolean | "partial";
  rowLabel: string;
  columnName: string;
}) {
  const label =
    value === true
      ? `${columnName} supports ${rowLabel}`
      : value === "partial"
        ? `${columnName} partially supports ${rowLabel}`
        : `${columnName} does not support ${rowLabel}`;

  if (value === true) {
    return (
      <span className="flex justify-center" role="img" aria-label={label}>
        <Icon name="check-circle" className="size-4 text-emerald-400" aria-hidden="true" />
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="flex justify-center" role="img" aria-label={label}>
        <Chip tone="warning" className="bg-transparent border-none">Partial</Chip>
      </span>
    );
  }
  return (
    <span className="flex justify-center" role="img" aria-label={label}>
      <Icon name="minus-circle" className="size-4 text-muted-foreground/40" aria-hidden="true" />
    </span>
  );
}

export function ReadinessScoreSection() {
  const { impact, from, to } = architectureChange.example;

  const stats = [
    { label: "Affected modules", value: impact.affectedModules },
    { label: "Compiler stages", value: compiler.pipeline.length },
    { label: "Engine layers", value: deterministicEngine.layers.length },
    { label: "Files in example PR", value: github.pullRequest.files.length },
  ];

  const eyebrowClass = "font-mono text-[11px] uppercase tracking-[0.16em] text-primary";
  const titleClass = "mt-5 text-4xl font-medium tracking-tight text-foreground md:text-5xl";

  return (
    <Section density="tight">
      <div id="solution">
        <Container size="wide" className="py-14 lg:py-20">
          <div className="grid gap-14 lg:grid-cols-2 lg:items-start lg:gap-20">
            <div className="flex flex-col">
              <p className={eyebrowClass}>{solution.eyebrow}</p>

              <h2 className={titleClass}>{solution.title}</h2>

              <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
                {solution.description}
              </p>

              <ol className="mt-10 flex flex-col border-t border-border">
                {[
                  "Execute against an isolated database",
                  "Compare the result row by row",
                  "Explain exactly what changed",
                ].map((step, i) => (
                  <li key={step} className="flex items-baseline gap-6 border-b border-border py-5">
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="text-sm text-foreground">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="border border-border bg-background mt-6">
              <div className="flex items-center justify-between px-5 py-4 md:px-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Execution
                </span>
                <Chip tone="success" className="border-none bg-transparent">
                  Live sandbox
                </Chip>
              </div>

              <ol className="divide-y divide-border border-t border-border">
                <li className="grid grid-cols-[2.5rem_1fr] gap-4 px-5 py-5 md:px-6">
                  <span className="font-mono text-[11px] text-muted-foreground">01</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-foreground">Query</span>
                      <span className="font-mono text-[10px] tracking-wide text-muted-foreground">INPUT</span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-foreground/80">SELECT * FROM users;</p>
                  </div>
                </li>

                <li className="grid grid-cols-[2.5rem_1fr] gap-4 px-5 py-5 md:px-6">
                  <span className="font-mono text-[11px] text-muted-foreground">02</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-foreground">Isolated Postgres</span>
                      <span className="font-mono text-[10px] tracking-wide text-muted-foreground">EXECUTE</span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-foreground/80">production · 1,284 rows</p>
                  </div>
                </li>

                <li className="grid grid-cols-[2.5rem_1fr] gap-4 px-5 py-5 md:px-6">
                  <span className="font-mono text-[11px] text-muted-foreground">03</span>
                  <div className="min-w-0">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-sm text-foreground">Result comparison</span>
                      <span className="font-mono text-[10px] tracking-wide text-muted-foreground">DIFF</span>
                    </div>
                    <p className="mt-2 font-mono text-xs text-foreground/80">
                      1,284 expected · <span className="text-primary">1,286 actual (+2)</span>
                    </p>
                  </div>
                </li>

                <li className="grid grid-cols-[2.5rem_1fr] gap-4 px-5 py-5 md:px-6">
                  <span className="font-mono text-[11px] text-muted-foreground">04</span>
                  <div className="min-w-0">
                    <span className="text-sm text-foreground">Explanation</span>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      The result differs because the updated schema includes two additional rows
                      introduced by the migration.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        </Container>
      </div>
    </Section>
  );
}
