import type { CSSProperties, ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Boxes,
  CheckCircle,
  ChevronsLeft,
  ChevronsRight,
  Circle,
  Clock,
  Code,
  Code2,
  Copy,
  Cpu,
  Database,
  FileCode,
  FolderTree,
  GitBranch,
  GitMerge,
  GitPullRequest,
  Layers,
  Menu,
  MinusCircle,
  Network,
  PanelLeft,
  PanelRight,
  RefreshCw,
  Rocket,
  RotateCcw,
  Scan,
  Search,
  Shield,
  ShieldCheck,
  Shuffle,
  Sparkles,
  Table2,
  Users,
  Wand,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@sql-learn/ui/lib/utils";
import { Badge } from "@sql-learn/ui/components/badge";
import { Separator } from "@sql-learn/ui/components/separator";

const iconMap: Record<string, LucideIcon> = {
  activity: Activity,
  "alert-triangle": AlertTriangle,
  "arrow-right": ArrowRight,
  bot: Bot,
  boxes: Boxes,
  "check-circle": CheckCircle,
  "chevrons-left": ChevronsLeft,
  "chevrons-right": ChevronsRight,
  clock: Clock,
  code: Code,
  "code-2": Code2,
  copy: Copy,
  cpu: Cpu,
  database: Database,
  "file-code": FileCode,
  "folder-tree": FolderTree,
  "git-branch": GitBranch,
  "git-merge": GitMerge,
  "git-pull-request": GitPullRequest,
  layers: Layers,
  menu: Menu,
  "minus-circle": MinusCircle,
  network: Network,
  "panel-left": PanelLeft,
  "panel-right": PanelRight,
  "refresh-cw": RefreshCw,
  rocket: Rocket,
  "rotate-ccw": RotateCcw,
  scan: Scan,
  search: Search,
  shield: Shield,
  "shield-check": ShieldCheck,
  shuffle: Shuffle,
  sparkles: Sparkles,
  "table-2": Table2,
  users: Users,
  wand: Wand,
  wrench: Wrench,
  x: X,
};

function GithubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.04-.72.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.75 2.69 1.25 3.34.96.1-.75.4-1.25.73-1.54-2.56-.29-5.25-1.28-5.25-5.71 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.06 11.06 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.44-2.7 5.42-5.27 5.7.42.36.78 1.07.78 2.16 0 1.56-.01 2.82-.01 3.2 0 .31.21.67.8.56A10.99 10.99 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}

export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  if (name === "github") {
    return <GithubMark className={className} />;
  }

  const IconComponent = iconMap[name] ?? Circle;

  return <IconComponent className={className} />;
}

const containerSizes = {
  default: "max-w-[1440px]",
  wide: "max-w-[1680px]",
  narrow: "max-w-[760px]",
} as const;

export function Container({
  className,
  size = "default",
  children,
}: {
  className?: string;
  size?: keyof typeof containerSizes;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 md:px-10 lg:px-14",
        containerSizes[size],
        className,
      )}
    >
      {children}
    </div>
  );
}

export function GraphScroller({
  className,
  minWidth = "640px",
  children,
}: {
  className?: string;
  minWidth?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <div
        className="min-w-(--graph-min-w) md:min-w-0"
        style={{ "--graph-min-w": minWidth } as CSSProperties}
      >
        {children}
      </div>
    </div>
  );
}

const sectionDensity = {
  tight: "py-10 md:py-14 lg:py-16",
  default: "py-14 md:py-20 lg:py-24",
  feature: "py-16 md:py-24 lg:py-28",
} as const;

export function Section({
  id,
  className,
  density = "default",
  children,
}: {
  id?: string;
  className?: string;
  density?: keyof typeof sectionDensity;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn("relative", sectionDensity[density], className)}>
      {children}
    </section>
  );
}

export function Eyebrow({
  icon,
  children,
  className,
}: {
  icon?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 border border-border bg-white/[0.03] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-primary",
        className,
      )}
    >
      {icon ? <Icon name={icon} className="size-3.5" /> : null}
      {children}
    </span>
  );
}

const headingSizes = {
  compact: "text-xl md:text-2xl",
  default: "text-2xl md:text-3xl",
  lg: "text-3xl md:text-4xl lg:text-5xl",
} as const;

const headingMaxWidth = {
  default: "max-w-2xl",
  wide: "max-w-3xl",
  none: "",
} as const;

export function SectionHeading({
  eyebrow,
  eyebrowIcon,
  eyebrowClassName,
  title,
  description,
  align = "center",
  size = "default",
  maxWidth = "default",
  className,
}: {
  eyebrow: string;
  eyebrowIcon?: string;
  eyebrowClassName?: string;
  title: ReactNode;
  description?: ReactNode;
  align?: "center" | "left";
  size?: keyof typeof headingSizes;
  maxWidth?: keyof typeof headingMaxWidth;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-5 md:gap-6",
        headingMaxWidth[maxWidth],
        align === "center" ? "mx-auto items-center text-center" : "items-start text-left",
        className,
      )}
    >
      <Eyebrow icon={eyebrowIcon} className={eyebrowClassName}>
        {eyebrow}
      </Eyebrow>
      <h2
        className={cn(
          "text-balance leading-[1.12] tracking-tight text-foreground",
          headingSizes[size],
        )}
      >
        {title}
      </h2>
      {description ? (
        <p className="text-balance text-sm leading-relaxed text-muted-foreground md:text-base">
          {description}
        </p>
      ) : null}
    </div>
  );
}

export function Panel({
  className,
  children,
  emphasis = false,
}: {
  className?: string;
  children: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative border bg-white/[0.02]",
        emphasis
          ? "border-primary/25"
          : "border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

const chipTones = {
  neutral:
    "border-border bg-white/[0.03] text-muted-foreground",
  accent:
    "border-primary/30 bg-primary/15 text-primary",
  success:
    "border-emerald-400/25 bg-emerald-400/10 text-emerald-400",
  warning:
    "border-amber-400/25 bg-amber-400/10 text-amber-400",
  danger:
    "border-destructive/25 bg-destructive/10 text-destructive",
} as const;

export function Chip({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof chipTones;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-auto gap-1.5 px-2.5 py-1 text-xs font-medium",
        chipTones[tone],
        className,
      )}
    >
      {children}
    </Badge>
  );
}

const statusToneMap: Record<string, keyof typeof chipTones> = {
  passed: "success",
  completed: "success",
  ready: "success",
  current: "accent",
  planned: "neutral",
  future: "neutral",
  warning: "warning",
  critical: "danger",
};

export function StatusDot({ status }: { status: string }) {
  const tone = statusToneMap[status] ?? "neutral";
  const dotColor = {
    neutral: "bg-muted-foreground",
    accent: "bg-primary",
    success: "bg-emerald-400",
    warning: "bg-amber-400",
    danger: "bg-destructive",
  }[tone];

  return (
    <span
      role="img"
      aria-label={status}
      className={cn("size-1.5 shrink-0", dotColor)}
    />
  );
}

export function Divider({ className }: { className?: string }) {
  return (
    <Separator
      className={cn(
        "bg-gradient-to-r from-transparent via-input to-transparent",
        className,
      )}
    />
  );
}

export function GridBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("mkt-grid-bg pointer-events-none absolute inset-0", className)}
    />
  );
}

export function DotBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("mkt-dot-bg pointer-events-none absolute inset-0", className)}
    />
  );
}

export function Marquee({
  className,
  children,
  reverse = false,
}: {
  className?: string;
  children: ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className={cn("mkt-marquee-mask relative overflow-hidden", className)}>
      <div
        className={cn(
          "mkt-marquee flex w-max items-center gap-10",
          reverse && "[animation-direction:reverse]",
        )}
      >
        <div className="flex items-center gap-10">{children}</div>
        <div className="flex items-center gap-10" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

export function StatTile({
  label,
  value,
  suffix,
  className,
}: {
  label: string;
  value: ReactNode;
  suffix?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "border border-border bg-white/[0.02] px-2 py-4 text-center sm:px-4 sm:py-5 lg:px-5 lg:py-6",
        className,
      )}
    >
      <div className="font-mono text-xl font-semibold tabular-nums text-foreground sm:text-2xl md:text-3xl lg:text-4xl">
        {value}
        {suffix ? (
          <span className="ml-1 text-sm text-muted-foreground lg:text-lg">{suffix}</span>
        ) : null}
      </div>
      <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground sm:text-xs lg:mt-2 lg:tracking-[0.12em]">
        {label}
      </div>
    </div>
  );
}

const scoreTone = (score: number) =>
  score >= 75 ? "bg-primary" : score >= 50 ? "bg-amber-400" : "bg-destructive";

export function ScoreBar({
  label,
  score,
  className,
}: {
  label: string;
  score: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground">{score}</span>
      </div>
      <div className="h-1.5 overflow-hidden bg-white/[0.06]">
        <div
          className={cn("h-full", scoreTone(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

export function FeatureTile({
  icon,
  title,
  description,
  visual,
  span,
  className,
  noVisualDivider,
}: {
  icon?: string;
  title: string;
  description: string;
  visual?: ReactNode;
  span?: "1" | "2" | "4";
  className?: string;
  noVisualDivider?: boolean;
}) {
  return (
    <Panel
      className={cn(
        "flex flex-col gap-4 p-6 md:p-7",
        span === "2" && "sm:col-span-2",
        span === "4" && "sm:col-span-2 lg:col-span-4",
        className,
      )}
    >
      {icon ? (
        <span className="flex size-9 items-center justify-center border border-border bg-white/[0.03] text-primary">
          <Icon name={icon} className="size-4" />
        </span>
      ) : null}
      <div className="flex min-h-[88px] flex-col gap-1.5">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {visual ? (
        <div
          className={cn(
            "flex flex-col gap-3",
            noVisualDivider ? "pt-1" : "border-t border-border pt-4",
          )}
        >
          {visual}
        </div>
      ) : null}
    </Panel>
  );
}
