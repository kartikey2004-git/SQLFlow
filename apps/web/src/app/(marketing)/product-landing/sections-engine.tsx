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
  FeatureTile,
  GraphScroller,
  Icon,
  Panel,
  Section,
  SectionHeading,
  StatTile,
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

export function ArchitectureEngineSection() {
  return (
    <Section id={architectureGraph.id} className="border-t border-border" density="feature">
      <Container size="wide" className="flex flex-col gap-14 lg:gap-16">
        <SectionHeading
          eyebrow={compiler.eyebrow}
          title={compiler.title}
          description={compiler.description}
          size="lg"
        />

        <div className="grid overflow-hidden border border-border sm:grid-cols-2 lg:grid-cols-4 [&>*]:-ml-px [&>*]:-mt-px">
          {architectureGraph.capabilities.map((cap) => (
            <FeatureTile
              key={cap.title}
              icon={capabilityIcons[cap.title] ?? "sparkles"}
              title={cap.title}
              description={cap.description}
            />
          ))}

          <FeatureTile
            span="4"
            icon="cpu"
            title="An interactive architecture workbench"
            description="Nodes for every dependency, a floating action toolbar, and collapsible panels for the YAML source and the generated file tree."

            noVisualDivider
          />

          {deterministicEngine.layers.map((layer) => (
            <FeatureTile
              key={layer.title}
              icon={layerIcons[layer.title] ?? "layers"}
              title={layer.title}
              description={layer.description}
              visual={
                <>
                  <span className="font-mono text-xs text-primary">{layer.number}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {layer.components.map((component) => (
                      <Chip key={component}>{component}</Chip>
                    ))}
                  </div>
                </>
              }
            />
          ))}

          <FeatureTile
            icon="shield-check"
            title={validation.title}
            description={validation.description}
            visual={
              <>
                <div className="flex flex-wrap gap-2">
                  {validation.pipeline.map((step) => (
                    <div
                      key={step.step}
                      className="flex items-center gap-2 px-3 py-1.5"
                    >
                      <span className="text-xs text-foreground">{step.step}</span>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2.5 border-t border-dashed border-border pt-4">
                  <span className="text-xs font-medium text-foreground">
                    {validation.failureLoop.title}
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {validation.failureLoop.steps.map((step, index) => (
                      <div key={step} className="flex items-center gap-1.5">
                        <span className="border border-border bg-white/[0.02] px-2.5 py-1 text-xs text-muted-foreground">
                          {step}
                        </span>
                        {index < validation.failureLoop.steps.length - 1 ? (
                          <Icon
                            name="arrow-right"
                            className="size-3 shrink-0 text-muted-foreground/50"
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            }
          />
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
    {
      label: "Affected modules",
      value: impact.affectedModules,
    },
    {
      label: "Compiler stages",
      value: compiler.pipeline.length,
    },
    {
      label: "Engine layers",
      value: deterministicEngine.layers.length,
    },
    {
      label: "Files in example PR",
      value: github.pullRequest.files.length,
    },
  ];

  return (
    <Section className="border-t border-border" density="tight">
      {/* ============================================================
          01 — THE DECISION
      ============================================================ */}
      <Container className="py-20 lg:py-28">
        <div className="max-w-3xl">
          <SectionHeading
            align="left"
            eyebrow="Impact analysis"
            title="One decision, seven ripples."
            description={`Swap ${from.technology} for ${to.technology} and watch what moves. Archon traces the change before you write a line of code.`}
            maxWidth="wide"
            size="lg"
          />

          {/* The actual decision */}
          <div className="mt-7 flex items-center gap-3">
            <Chip>{from.technology}</Chip>

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <div className="h-px w-6 bg-border" />

              <Icon name="arrow-right" className="size-4" />

              <div className="h-px w-6 bg-border" />
            </div>

            <Chip>{to.technology}</Chip>
          </div>
        </div>

        {/* Impact numbers */}
        <div className="mt-12 grid grid-cols-2 overflow-hidden border border-border md:grid-cols-4">
          {stats.map((stat) => (
            <StatTile
              key={stat.label}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>
      </Container>

      {/* ============================================================
          02 — THE RIPPLE
      ============================================================ */}
      <div className="border-y border-border">
        <Container
          size="wide"
          className="py-20 lg:py-28"
        >
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-20">
            {/* Text */}
            <div className="max-w-md">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                The ripple
              </p>

              <h2 className="mt-5 text-3xl font-medium tracking-tight text-foreground md:text-4xl">
                One change doesn't stay in one place.
              </h2>

              <p className="mt-5 text-sm leading-6 text-muted-foreground">
                Archon follows the dependency chain from the original
                decision through the compiler and engine until it reaches
                the code that needs to change.
              </p>

              <p className="mt-5 border-l border-border pl-4 text-xs leading-5 text-muted-foreground">
                The numbers above aren't estimates. They're the actual
                downstream impact of this example change.
              </p>
            </div>

           
          </div>
        </Container>
      </div>

      {/* ============================================================
          03 — THE SOLUTION
      ============================================================ */}
      <div
        id="solution"
        className="border-b border-border"
      >
        <Container
          size="wide"
          className="py-20 lg:py-32"
        >
          <div className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:items-center lg:gap-20">
            {/* Text */}
            <div className="max-w-lg">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                {solution.eyebrow}
              </p>

              <h2 className="mt-5 text-4xl font-medium tracking-tight text-foreground md:text-5xl">
                {solution.title}
              </h2>

              <p className="mt-6 max-w-md text-sm leading-6 text-muted-foreground">
                {solution.description}
              </p>

              <div className="mt-8 flex flex-col gap-3 border-l border-border pl-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center border border-border font-mono text-[10px] text-primary">
                    01
                  </span>

                  <span className="text-sm text-foreground/90">
                    Execute against an isolated database
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center border border-border font-mono text-[10px] text-primary">
                    02
                  </span>

                  <span className="text-sm text-foreground/90">
                    Compare the result row by row
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="flex size-6 items-center justify-center border border-border font-mono text-[10px] text-primary">
                    03
                  </span>

                  <span className="text-sm text-foreground/90">
                    Explain exactly what changed
                  </span>
                </div>
              </div>
            </div>

            {/* Execution flow */}
            <Panel className="overflow-hidden p-0">
              <div className="border-b border-border px-5 py-4 md:px-7">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    Execution
                  </span>

                  <Chip
                    tone="success"
                    className="border-none bg-transparent"
                  >
                    Live sandbox
                  </Chip>
                </div>
              </div>

              <div className="p-5 md:p-7">
                <div className="flex flex-col">
                  {/* Input */}
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Query
                      </span>

                      <span className="font-mono text-[10px] text-muted-foreground">
                        INPUT
                      </span>
                    </div>

                    <div className="font-mono text-xs leading-6 text-foreground/80">
                      SELECT * FROM users;
                    </div>
                  </div>

                  <div className="flex h-8 items-center justify-center">
                    <Icon
                      name="arrow-down"
                      className="size-4 text-muted-foreground"
                    />
                  </div>

                  {/* Sandbox */}
                  <div className="rounded-lg border border-primary/20 bg-primary/[0.025] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-xs text-primary">
                        Isolated Postgres
                      </span>

                      <span className="font-mono text-[10px] text-primary/70">
                        EXECUTE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-border p-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Schema
                        </p>

                        <p className="mt-1 text-xs text-foreground/80">
                          production
                        </p>
                      </div>

                      <div className="border border-border p-3">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          Rows
                        </p>

                        <p className="mt-1 text-xs text-foreground/80">
                          1,284
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex h-8 items-center justify-center">
                    <Icon
                      name="arrow-down"
                      className="size-4 text-muted-foreground"
                    />
                  </div>

                  {/* Compare */}
                  <div className="rounded-lg border border-border p-4">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Result comparison
                      </span>

                      <span className="font-mono text-[10px] text-muted-foreground">
                        DIFF
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Expected
                        </p>

                        <div className="font-mono text-xs text-foreground/70">
                          1,284 rows
                        </div>
                      </div>

                      <div>
                        <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                          Actual
                        </p>

                        <div className="font-mono text-xs text-primary">
                          1,286 rows
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex h-8 items-center justify-center">
                    <Icon
                      name="arrow-down"
                      className="size-4 text-muted-foreground"
                    />
                  </div>

                  {/* Explanation */}
                  <div className="rounded-lg border border-dashed border-border bg-transparent p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <Icon
                        name="sparkles"
                        className="size-4 text-primary"
                      />

                      <span className="text-xs text-foreground">
                        Explanation
                      </span>
                    </div>

                    <p className="text-xs leading-5 text-muted-foreground">
                      The result differs because the updated schema includes
                      two additional rows introduced by the migration.
                    </p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>
        </Container>
      </div>

      {/* ============================================================
          04 — WHY ARCHON
      ============================================================ */}
      <div>
        <Container
          size="wide"
          className="py-20 lg:py-28"
        >
          {/* Story intro */}
          <div className="max-w-2xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
              {comparison.eyebrow}
            </p>

            <h2 className="mt-5 text-4xl font-medium tracking-tight text-foreground md:text-5xl">
              {comparison.title}
            </h2>

            <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground">
              {comparison.description}
            </p>
          </div>

          {/* Comparison */}
          <div className="mt-12 lg:mt-16">
            {/* Mobile */}
            <div className="flex flex-col gap-3 md:hidden">
              {comparison.rows.map((row) => (
                <Panel
                  key={row.label}
                  className="overflow-hidden p-0"
                >
                  <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
                    <span className="text-sm text-foreground/90">
                      {row.label}
                    </span>

                    <Chip
                      tone={archonStatusTone[row.archonStatus]}
                      className="shrink-0 border-none bg-transparent"
                    >
                      {row.archonStatus === "shipped"
                        ? "Shipped"
                        : "Planned"}
                    </Chip>
                  </div>

                  <div className="flex flex-col divide-y divide-border">
                    {comparison.columns.map((column, index) => {
                      const value = row.values[index];

                      const isHighlighted =
                        "highlighted" in column && column.highlighted;

                      return (
                        <div
                          key={column.name}
                          className="flex items-center justify-between gap-4 px-4 py-3"
                        >
                          <div
                            className={
                              isHighlighted
                                ? "flex min-w-0 items-center gap-2 text-sm text-primary"
                                : "flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
                            }
                          >
                            <Icon
                              name={column.icon}
                              className="size-4 shrink-0"
                            />

                            <span className="truncate">
                              {column.name}
                            </span>
                          </div>

                          {value !== undefined && (
                            <CapabilityCell
                              value={value}
                              rowLabel={row.label}
                              columnName={column.name}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Panel>
              ))}
            </div>

            {/* Desktop */}
            <Panel className="hidden overflow-hidden p-0 md:block">
              <GraphScroller minWidth="640px">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="w-[34%] p-4 text-left font-normal text-muted-foreground" />

                      {comparison.columns.map((column) => {
                        const isHighlighted =
                          "highlighted" in column && column.highlighted;

                        return (
                          <th
                            key={column.name}
                            className={
                              isHighlighted
                                ? "border-l border-primary/20 bg-primary/[0.025] p-4 text-center font-normal text-primary"
                                : "p-4 text-center font-normal text-muted-foreground"
                            }
                          >
                            <div className="flex flex-col items-center gap-1.5">
                              <Icon
                                name={column.icon}
                                className="size-4"
                              />

                              <span className="whitespace-nowrap">
                                {column.name}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>

                  <tbody>
                    {comparison.rows.map((row) => (
                      <tr
                        key={row.label}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-foreground/90">
                              {row.label}
                            </span>

                            <Chip
                              tone={archonStatusTone[row.archonStatus]}
                              className="shrink-0 border-none bg-transparent"
                            >
                              {row.archonStatus === "shipped"
                                ? "Shipped"
                                : "Planned"}
                            </Chip>
                          </div>
                        </td>

                        {row.values.map((value, index) => {
                          const column = comparison.columns[index];

                          const isHighlighted =
                            column &&
                            "highlighted" in column &&
                            column.highlighted;

                          return (
                            <td
                              key={`${row.label}-${column?.name ?? index}`}
                              className={
                                isHighlighted
                                  ? "border-l border-primary/10 bg-primary/[0.015] p-4"
                                  : "p-4"
                              }
                            >
                              <CapabilityCell
                                value={value}
                                rowLabel={row.label}
                                columnName={
                                  column?.name ?? "This column"
                                }
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </GraphScroller>
            </Panel>

            {/* Legend */}
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Archon is at V0 today.{" "}
              <span className="text-foreground">Shipped</span> rows are
              available now;{" "}
              <span className="text-foreground">Planned</span> rows are on the{" "}
              <HashLink
                href="#roadmap"
                className="underline decoration-muted-foreground/50 underline-offset-4 transition-colors hover:text-foreground"
              >
                roadmap
              </HashLink>
              .
            </p>
          </div>
        </Container>
      </div>
    </Section>
  );
}