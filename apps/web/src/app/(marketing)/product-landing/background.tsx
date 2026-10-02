import { GridBackdrop } from "./primitives";

export function MarketingBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <div className="absolute inset-0 bg-background" />

      <div
        className="absolute left-1/2 top-[-10%] h-[560px] w-[900px] -translate-x-1/2 opacity-[0.16]"
        style={{
          background:
            "radial-gradient(closest-side, var(--primary), transparent 72%)",
          filter: "blur(60px)",
        }}
      />

      <div
        className="absolute left-1/2 top-[6%] h-[420px] w-[720px] -translate-x-1/2 opacity-[0.10]"
        style={{
          background:
            "radial-gradient(closest-side, #4f7cff, transparent 70%)",
          filter: "blur(70px)",
        }}
      />

      <GridBackdrop className="top-0 h-[900px]" />

      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='90' height='90'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-background to-transparent" />
    </div>
  );
}
