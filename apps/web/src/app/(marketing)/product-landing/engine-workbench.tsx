"use client";

import { useState } from "react";
import { cn } from "@sql-learn/ui/lib/utils";
import { architectureArtifact, architectureGraph, compiler, github } from "../data";
import { ArchitectureGraph } from "./graph";
import { Icon } from "./primitives";

const mobileTabs = [
  { key: "graph", label: "Graph", icon: "network" },
  { key: "yaml", label: "YAML", icon: "file-code" },
  { key: "files", label: "Files", icon: "folder-tree" },
] as const;

type MobileTab = (typeof mobileTabs)[number]["key"];

export function EngineWorkbench() {
  const [yamlOpen, setYamlOpen] = useState(true);
  const [treeOpen, setTreeOpen] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>("graph");

  return (
    <div className="relative -mx-6 -mb-6 overflow-hidden bg-[#0a0a0b] md:-mx-7 md:-mb-7">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative z-20 flex justify-center px-4 pt-6 lg:px-6 lg:pt-8">
        <div className="flex flex-wrap items-center gap-0.5 border border-border bg-background/90 p-1.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md">
          {github.flow.map((step) => (
            <button
              key={step.label}
              type="button"
              title={step.label}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
            >
              <Icon name={step.icon} className="size-3.5" />
              <span className="hidden lg:inline">{step.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative mt-6 flex flex-col gap-3 px-4 md:hidden">
        <div className="flex border border-border">
          {mobileTabs.map((tab) => {
            const active = mobileTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setMobileTab(tab.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon name={tab.icon} className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="h-[300px] overflow-hidden border border-dashed border-border bg-white/[0.015]">
          {mobileTab === "graph" ? (
            <ArchitectureGraph
              nodes={architectureGraph.example.entities}
              edges={architectureGraph.example.relationships}
              animated
              height="h-full"
              className="p-4"
            />
          ) : null}

          {mobileTab === "yaml" ? (
            <pre className="h-full overflow-auto p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {compiler.architectureDefinition.code}
            </pre>
          ) : null}

          {mobileTab === "files" ? (
            <ul className="h-full overflow-auto p-4">
              {architectureArtifact.tree.children.map((branch) => (
                <li key={branch.label} className="mb-3 flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
                    <Icon name="folder-tree" className="size-3 text-primary" />
                    {branch.label}/
                  </span>
                  <ul className="flex flex-col gap-0.5 border-l border-border pl-3">
                    {branch.children.map((leaf) => (
                      <li key={leaf} className="font-mono text-[11px] text-muted-foreground/70">
                        {leaf}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="relative mt-6 hidden overflow-x-auto md:block">
        <div className="flex h-[440px] min-w-[560px] lg:min-w-[720px] md:h-[480px]">
          <aside
            className={cn(
              "relative shrink-0 overflow-hidden border-r border-dashed border-border bg-white/[0.015] transition-[width] duration-300 ease-out",
              yamlOpen ? "w-[190px] lg:w-[240px]" : "w-0 border-r-0",
            )}
          >
            <div className="flex h-full w-[190px] flex-col lg:w-[240px]">
              <div className="flex items-center justify-between border-b border-dashed border-border px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  architecture.{compiler.architectureDefinition.language}
                </span>
                <button
                  type="button"
                  onClick={() => setYamlOpen(false)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Collapse YAML panel"
                >
                  <Icon name="panel-left" className="size-3.5" />
                </button>
              </div>
              <pre className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {compiler.architectureDefinition.code}
              </pre>
            </div>
          </aside>

          {!yamlOpen ? (
            <button
              type="button"
              onClick={() => setYamlOpen(true)}
              className="z-10 flex shrink-0 items-center border-r border-dashed border-border bg-white/[0.015] px-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Expand YAML panel"
            >
              <Icon name="chevrons-right" className="size-3.5" />
            </button>
          ) : null}

          <div className="relative min-w-0 flex-1">
            <ArchitectureGraph
              nodes={architectureGraph.example.entities}
              edges={architectureGraph.example.relationships}
              animated
              height="h-full"
              className="p-5 lg:p-8"
            />
          </div>

          {!treeOpen ? (
            <button
              type="button"
              onClick={() => setTreeOpen(true)}
              className="z-10 flex shrink-0 items-center border-l border-dashed border-border bg-white/[0.015] px-1.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Expand file tree panel"
            >
              <Icon name="chevrons-left" className="size-3.5" />
            </button>
          ) : null}

          <aside
            className={cn(
              "relative shrink-0 overflow-hidden border-l border-dashed border-border bg-white/[0.015] transition-[width] duration-300 ease-out",
              treeOpen ? "w-[190px] lg:w-[240px]" : "w-0 border-l-0",
            )}
          >
            <div className="flex h-full w-[190px] flex-col lg:w-[240px]">
              <div className="flex items-center justify-between border-b border-dashed border-border px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {architectureArtifact.tree.label}/
                </span>
                <button
                  type="button"
                  onClick={() => setTreeOpen(false)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Collapse file tree panel"
                >
                  <Icon name="panel-right" className="size-3.5" />
                </button>
              </div>
              <ul className="flex-1 overflow-auto p-4 pl-5">
                {architectureArtifact.tree.children.map((branch) => (
                  <li key={branch.label} className="mb-3 flex flex-col gap-1">
                    <span className="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
                      <Icon name="folder-tree" className="size-3 text-primary" />
                      {branch.label}/
                    </span>
                    <ul className="flex flex-col gap-0.5 border-l border-border pl-3">
                      {branch.children.map((leaf) => (
                        <li
                          key={leaf}
                          className="font-mono text-[11px] text-muted-foreground/70"
                        >
                          {leaf}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </div>

      <div className="relative flex flex-wrap items-center gap-2 border-t border-dashed border-border px-4 py-3 lg:px-6 lg:py-4">
        {compiler.pipeline.map((step, index) => (
          <div key={step.step} className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-primary">{step.step}</span>
            <Icon name={step.icon} className="size-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{step.label}</span>
            {index < compiler.pipeline.length - 1 ? (
              <Icon name="arrow-right" className="ml-0.5 size-3 text-muted-foreground/40" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
