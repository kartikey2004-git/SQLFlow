import { cn } from "@sql-learn/ui/lib/utils";

export type GraphNode = {
  id: string;
  label: string;
  type?: string;
  technology?: string;
};

export type GraphEdge = readonly [string, string];

const emphasizedTypes = new Set(["core", "engine"]);

function layoutGraph(nodes: readonly GraphNode[], edges: readonly GraphEdge[]) {
  const ids = nodes.map((n) => n.id);
  const adjacency = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  ids.forEach((id) => {
    adjacency.set(id, []);
    indegree.set(id, 0);
  });

  edges.forEach(([from, to]) => {
    if (!adjacency.has(from) || !indegree.has(to)) return;
    adjacency.get(from)!.push(to);
    indegree.set(to, (indegree.get(to) ?? 0) + 1);
  });

  const depth = new Map<string, number>(ids.map((id) => [id, 0]));
  const remaining = new Map(indegree);
  const order = ids.filter((id) => (indegree.get(id) ?? 0) === 0);
  const visited = new Set(order);

  let cursor = 0;
  while (cursor < order.length) {
    const current = order[cursor++]!;
    for (const next of adjacency.get(current) ?? []) {
      depth.set(next, Math.max(depth.get(next) ?? 0, (depth.get(current) ?? 0) + 1));
      remaining.set(next, (remaining.get(next) ?? 0) - 1);
      if (remaining.get(next) === 0 && !visited.has(next)) {
        visited.add(next);
        order.push(next);
      }
    }
  }

  ids.forEach((id) => {
    if (!visited.has(id)) order.push(id);
  });

  const columns = new Map<number, string[]>();
  ids.forEach((id) => {
    const d = depth.get(id) ?? 0;
    const bucket = columns.get(d) ?? [];
    bucket.push(id);
    columns.set(d, bucket);
  });

  const maxDepth = Math.max(0, ...Array.from(columns.keys()));
  const positions = new Map<string, { x: number; y: number }>();

  columns.forEach((colIds, colDepth) => {
    const x = maxDepth === 0 ? 50 : 9 + (colDepth / maxDepth) * 82;
    colIds.forEach((id, index) => {
      const y = colIds.length <= 1 ? 50 : 12 + (index / (colIds.length - 1)) * 76;
      positions.set(id, { x, y });
    });
  });

  return positions;
}

export function ArchitectureGraph({
  nodes,
  edges,
  className,
  animated = false,
  height = "h-[360px] md:h-[420px]",
}: {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  className?: string;
  animated?: boolean;
  height?: string;
}) {
  const positions = layoutGraph(nodes, edges);

  return (
    <div className={cn("relative w-full", height, className)}>
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="mkt-edge-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--input)" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        {edges.map(([from, to], index) => {
          const a = positions.get(from);
          const b = positions.get(to);
          if (!a || !b) return null;
          const midX = (a.x + b.x) / 2;
          return (
            <path
              key={`${from}-${to}-${index}`}
              d={`M ${a.x} ${a.y} C ${midX} ${a.y}, ${midX} ${b.y}, ${b.x} ${b.y}`}
              fill="none"
              stroke="url(#mkt-edge-gradient)"
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              className={animated ? "mkt-edge-animated" : undefined}
            />
          );
        })}
      </svg>

      {nodes.map((node) => {
        const pos = positions.get(node.id);
        if (!pos) return null;
        const emphasized = node.type ? emphasizedTypes.has(node.type) : false;

        return (
          <div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          >
            <div
              className={cn(
                "flex flex-col items-center gap-0.5 whitespace-nowrap border px-2.5 py-1.5 text-[11px] font-medium backdrop-blur-md",
                emphasized
                  ? "border-primary/45 bg-primary/15 text-foreground shadow-[0_0_24px_-6px_var(--primary)]"
                  : "border-border bg-white/[0.03] text-muted-foreground",
              )}
            >
              <span>{node.label}</span>
              {node.technology ? (
                <span className="text-[9.5px] font-normal text-muted-foreground">
                  {node.technology}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
