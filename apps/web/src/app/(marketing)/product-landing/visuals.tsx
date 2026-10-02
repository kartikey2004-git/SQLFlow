import type { ReactNode } from "react";
import { cn } from "@sql-learn/ui/lib/utils";

function TileCanvas({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mkt-grid-bg relative h-32 w-full overflow-hidden border border-border bg-white/[0.015] [mask-image:none] [-webkit-mask-image:none]",
        className,
      )}
    >
      {children}
    </div>
  );
}

type Square = { x: number; y: number; size: number; filled?: boolean };

const clusterPresets: Record<number, Square[]> = {
  0: [
    { x: 14, y: 18, size: 30 },
    { x: 30, y: 40, size: 34, filled: true },
    { x: 8, y: 52, size: 22 },
    { x: 50, y: 34, size: 26 },
  ],
  1: [
    { x: 12, y: 44, size: 24 },
    { x: 30, y: 20, size: 22 },
    { x: 44, y: 38, size: 26, filled: true },
    { x: 58, y: 50, size: 20 },
  ],
  2: [
    { x: 16, y: 16, size: 28, filled: true },
    { x: 48, y: 22, size: 32, filled: true },
    { x: 60, y: 44, size: 20 },
  ],
  3: [
    { x: 44, y: 16, size: 36, filled: true },
    { x: 22, y: 42, size: 30 },
    { x: 8, y: 54, size: 20 },
  ],
  4: [
    { x: 8, y: 30, size: 24 },
    { x: 26, y: 14, size: 22 },
    { x: 58, y: 18, size: 26 },
    { x: 58, y: 46, size: 22, filled: true },
  ],
};

export function TileArt({ variant = 0 }: { variant?: number }) {
  const squares = clusterPresets[variant % 5] ?? clusterPresets[0]!;

  return (
    <TileCanvas>
      {squares.map((square, index) => (
        <span
          key={index}
          className={cn(
            "absolute",
            square.filled
              ? "border border-primary/50 bg-primary/25"
              : "border border-primary/35 bg-transparent",
          )}
          style={{
            left: `${square.x}%`,
            top: `${square.y}%`,
            width: `${square.size}%`,
            height: `${square.size}%`,
          }}
        />
      ))}
    </TileCanvas>
  );
}

export function MeterBar({
  label,
  sublabel,
  split,
  current,
  delta,
}: {
  label: string;
  sublabel: string;
  split: number;
  current: string;
  delta: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-0.5" aria-hidden="true">
          <span className="h-2.5 w-1 bg-primary" />
          <span className="h-2.5 w-1 bg-primary" />
          <span className="h-2.5 w-1 bg-primary/40" />
        </span>
        <span className="text-xs font-medium uppercase tracking-wide text-foreground">
          {label}
        </span>
        <span className="text-[11px] text-muted-foreground">{sublabel}</span>
      </div>

      <div className="flex h-2 gap-1 overflow-hidden">
        <div
          className="h-full bg-primary"
          style={{ width: `${split}%` }}
        />
        <div
          className="h-full flex-1 border border-border bg-white/[0.03]"
        />
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
        <span className="font-mono text-foreground">{current}</span>
        <span className="font-mono text-primary">{delta}</span>
      </div>
    </div>
  );
}

export function MonthlyStepChart({
  months,
}: {
  months: readonly { label: string; value: number }[];
}) {
  const max = Math.max(...months.map((m) => m.value));
  const points = months.map((m, i) => {
    const x = (i / (months.length - 1)) * 100;
    const y = 100 - (m.value / max) * 100;
    return { ...m, x, y };
  });

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <div className="flex flex-col gap-2">
      <div className="relative h-40 w-full md:h-48">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          {points.map((p) => (
            <line
              key={`guide-${p.label}`}
              x1={p.x}
              y1={0}
              x2={p.x}
              y2={100}
              stroke="var(--input)"
              strokeWidth={0.4}
              strokeDasharray="1.5 2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={path}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={0.6}
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {points.map((p) => (
          <span
            key={`node-${p.label}`}
            className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 border border-primary bg-background"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          />
        ))}

        <div className="absolute inset-x-0 -top-6 flex justify-between font-mono text-[11px] text-muted-foreground">
          {points.map((p) => (
            <span key={`value-${p.label}`}>{p.value}</span>
          ))}
        </div>
      </div>

      <div className="flex justify-between font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        {points.map((p) => (
          <span key={`label-${p.label}`}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

export function MiniStepChart() {
  return (
    <TileCanvas className="flex items-center justify-center">
      <svg viewBox="0 0 100 60" className="h-3/4 w-3/4 overflow-visible">
        <path
          d="M 10 46 L 40 46 L 40 26 L 65 26 L 65 12 L 90 12"
          fill="none"
          stroke="var(--primary)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={10} cy={46} r={2} fill="var(--background)" stroke="var(--primary)" strokeWidth={1.2} />
        <circle cx={90} cy={12} r={2} fill="var(--primary)" />
      </svg>
    </TileCanvas>
  );
}

const stripeTones = ["bg-primary/70", "bg-[#4f7cff]/60", "bg-white/10", "bg-primary/25"];

export function StripeBars() {
  return (
    <TileCanvas className="flex items-end gap-1 p-3">
      {Array.from({ length: 18 }).map((_, i) => (
        <span
          key={i}
          className={cn("w-full", stripeTones[i % stripeTones.length])}
          style={{ height: `${30 + ((i * 37) % 65)}%` }}
        />
      ))}
    </TileCanvas>
  );
}

export function HorizontalBars() {
  const rows = [82, 46, 68, 30, 58];
  return (
    <TileCanvas className="flex flex-col justify-center gap-2 px-4">
      {rows.map((width, i) => (
        <div key={i} className="flex h-1.5 w-full overflow-hidden bg-white/[0.05]">
          <span
            className={cn(
              "h-full",
              i % 2 === 0 ? "bg-primary/70" : "bg-[#4f7cff]/60",
            )}
            style={{ width: `${width}%` }}
          />
        </div>
      ))}
    </TileCanvas>
  );
}

export function CornerFrame({ className }: { className?: string }) {
  const corner = "absolute size-4 border-primary/60";
  return (
    <div className={cn("pointer-events-none absolute inset-6", className)} aria-hidden="true">
      <span className={cn(corner, "left-0 top-0 border-l-2 border-t-2")} />
      <span className={cn(corner, "right-0 top-0 border-r-2 border-t-2")} />
      <span className={cn(corner, "bottom-0 left-0 border-b-2 border-l-2")} />
      <span className={cn(corner, "bottom-0 right-0 border-b-2 border-r-2")} />
    </div>
  );
}
