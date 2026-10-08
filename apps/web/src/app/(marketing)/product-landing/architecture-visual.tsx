const CX = 305, CY = 385, S = 30;
const cos30 = Math.cos(Math.PI / 6);
const sin30 = 0.5;

const GREEN = "#059669";
const GREEN_STRONG = "#047857";
const GREEN_MID = "rgba(5,150,105,0.5)";
const GREEN_SOFT = "rgba(5,150,105,0.22)";
const GREEN_TINT = "rgba(16,185,129,0.10)";
const GREEN_STRIP = "rgba(16,185,129,0.40)";
const SIDE = "#eef7f3";
const INK = "rgba(71,85,105,0.38)";

type P3 = [number, number, number];
type Plane = (u: number, v: number) => P3;

function iso(x: number, y: number, z: number): [number, number] {
  return [
    CX + (x - y) * cos30 * S,
    CY + (x + y) * sin30 * S - z * S,
  ];
}
function pt(x: number, y: number, z: number) {
  return iso(x, y, z).join(",");
}
function pp(...c: P3[]) {
  return c.map(([x, y, z]) => pt(x, y, z)).join(" ");
}
function Q({ uv, u0, v0, u1, v1, fill, stroke, sw = 0.6 }: {
  uv: Plane; u0: number; v0: number; u1: number; v1: number;
  fill: string; stroke?: string; sw?: number;
}) {
  return (
    <polygon points={pp(uv(u0, v0), uv(u1, v0), uv(u1, v1), uv(u0, v1))}
      fill={fill} stroke={stroke} strokeWidth={sw} />
  );
}

function Block({ x0, y0, z, w, d, h, top }: {
  x0: number; y0: number; z: number; w: number; d: number; h: number; top: string;
}) {
  return (
    <g>
      <polygon points={pp([x0 + 0.2, y0 + 0.2, 0], [x0 + w + 0.2, y0 + 0.2, 0], [x0 + w + 0.2, y0 + d + 0.2, 0], [x0 + 0.2, y0 + d + 0.2, 0])}
        fill="rgba(5,150,105,0.12)" />
      <polygon points={pp([x0 + w, y0, z], [x0 + w, y0 + d, z], [x0 + w, y0 + d, z + h], [x0 + w, y0, z + h])}
        fill={SIDE} stroke={GREEN_MID} strokeWidth="0.6" />
      <polygon points={pp([x0, y0, z], [x0 + w, y0, z], [x0 + w, y0, z + h], [x0, y0, z + h])}
        fill={SIDE} stroke={GREEN_MID} strokeWidth="0.6" />
      <polygon points={pp([x0, y0, z + h], [x0 + w, y0, z + h], [x0 + w, y0 + d, z + h], [x0, y0 + d, z + h])}
        fill={top} stroke={GREEN} strokeWidth="0.8" />
    </g>
  );
}

function DbCylinder({ cx, cy, z0, r, h, rings }: {
  cx: number; cy: number; z0: number; r: number; h: number; rings: number;
}) {
  const N = 32;
  const g = (i: number, z: number, k = 1): P3 => {
    const a = (i / N) * Math.PI * 2;
    return [cx + k * r * Math.cos(a), cy + k * r * Math.sin(a), z];
  };
  const top = z0 + h;
  return (
    <g>
      {Array.from({ length: N }, (_, i) => (
        <polygon key={`dbs${i}`}
          points={pp(g(i, z0), g(i + 1, z0), g(i + 1, top), g(i, top))}
          fill="url(#sqlSide)" />
      ))}
      {Array.from({ length: rings - 1 }, (_, k) => {
        const z = z0 + (h * (k + 1)) / rings;
        return (
          <polyline key={`dbr${k}`}
            points={pp(...Array.from({ length: N + 1 }, (_, i) => g(i, z)))}
            fill="none" stroke={GREEN_SOFT} strokeWidth="0.6" />
        );
      })}
      <polygon points={pp(...Array.from({ length: N }, (_, i) => g(i, top)))}
        fill="url(#sqlTop)" stroke={GREEN} strokeWidth="0.9" />
      <polyline points={pp(...Array.from({ length: N + 1 }, (_, i) => g(i, top, 0.72)))}
        fill="none" stroke={GREEN_SOFT} strokeWidth="0.5" />
      <polyline points={pp(...Array.from({ length: N + 1 }, (_, i) => g(i, z0)))}
        fill="none" stroke={GREEN_MID} strokeWidth="0.7" />
    </g>
  );
}

function EditorSheet({ x0, y0, z, w, d, h }: { x0: number; y0: number; z: number; w: number; d: number; h: number }) {
  const zt = z + h;
  const uv: Plane = (u, v) => [x0 + u * w, y0 + v * d, zt];
  const lines = [
    { kw: 0.12, body: 0.5, str: 0 },
    { kw: 0.1, body: 0.7, str: 0 },
    { kw: 0.12, body: 0.38, str: 0.16 },
    { kw: 0.08, body: 0.28, str: 0 },
  ];
  return (
    <g>
      <Block x0={x0} y0={y0} z={z} w={w} d={d} h={h} top="#ffffff" />
      <Q uv={uv} u0={0} v0={0} u1={1} v1={0.16} fill={GREEN_SOFT} />
      {[0.07, 0.11, 0.15].map(u => (
        <Q key={`tb${u}`} uv={uv} u0={u - 0.012} v0={0.06} u1={u + 0.012} v1={0.1} fill={GREEN} />
      ))}
      <Q uv={uv} u0={0.04} v0={0.2} u1={0.2} v1={0.96} fill="rgba(148,163,184,0.10)" />
      {lines.map((ln, i) => {
        const v = 0.3 + i * 0.16;
        const x = 0.36;
        return (
          <g key={`ln${i}`}>
            <Q uv={uv} u0={0.09} v0={v - 0.025} u1={0.13} v1={v + 0.025} fill={INK} />
            <Q uv={uv} u0={0.26} v0={v - 0.028} u1={0.26 + ln.kw} v1={v + 0.028} fill={GREEN} />
            <Q uv={uv} u0={x} v0={v - 0.028} u1={x + ln.body * 0.5} v1={v + 0.028} fill={INK} />
            {ln.str > 0 && (
              <Q uv={uv} u0={x + ln.body * 0.5 + 0.03} v0={v - 0.028} u1={x + ln.body * 0.5 + 0.03 + ln.str} v1={v + 0.028} fill="rgba(52,211,153,0.7)" />
            )}
          </g>
        );
      })}
    </g>
  );
}

function ResultSheet({ x0, y0, z, w, d, h, rows }: {
  x0: number; y0: number; z: number; w: number; d: number; h: number; rows: boolean[];
}) {
  const zt = z + h;
  const uv: Plane = (u, v) => [x0 + u * w, y0 + v * d, zt];
  const band = 0.2;
  const step = (1 - band) / rows.length;
  return (
    <g>
      <Block x0={x0} y0={y0} z={z} w={w} d={d} h={h} top="#ffffff" />
      <Q uv={uv} u0={0} v0={0} u1={1} v1={band} fill={GREEN_SOFT} />
      <Q uv={uv} u0={0.08} v0={band * 0.36} u1={0.36} v1={band * 0.64} fill={GREEN_STRONG} />
      <Q uv={uv} u0={0.5} v0={band * 0.36} u1={0.7} v1={band * 0.64} fill={GREEN_STRONG} />
      <Q uv={uv} u0={0.8} v0={band * 0.36} u1={0.92} v1={band * 0.64} fill={GREEN_STRONG} />
      {rows.map((ok, i) => {
        const v0 = band + i * step + 0.03;
        const v1 = band + (i + 1) * step - 0.03;
        const mid = (v0 + v1) / 2;
        return (
          <g key={`rr${i}`}>
            <Q uv={uv} u0={0.03} v0={v0} u1={0.97} v1={v1}
              fill={ok ? GREEN_TINT : GREEN_STRIP}
              stroke={ok ? undefined : GREEN_STRONG} sw={0.7} />
            <Q uv={uv} u0={0.08} v0={mid - 0.03} u1={0.34} v1={mid + 0.03} fill={INK} />
            <Q uv={uv} u0={0.5} v0={mid - 0.03} u1={0.64} v1={mid + 0.03} fill={INK} />
            {ok ? (
              <Q uv={uv} u0={0.8} v0={mid - 0.07} u1={0.9} v1={mid + 0.07} fill={GREEN} />
            ) : (
              <polygon points={pp(uv(0.8, mid - 0.07), uv(0.9, mid - 0.07), uv(0.9, mid + 0.07), uv(0.8, mid + 0.07))}
                fill="#ffffff" stroke={GREEN_STRONG} strokeWidth="0.8" />
            )}
          </g>
        );
      })}
      <Q uv={uv} u0={0.44} v0={band} u1={0.447} v1={1} fill="rgba(5,150,105,0.18)" />
      <Q uv={uv} u0={0.74} v0={band} u1={0.747} v1={1} fill="rgba(5,150,105,0.18)" />
    </g>
  );
}

function Chip({ at, label }: { at: [number, number]; label: string }) {
  const [x, y] = at;
  const w = label.length * 6.4 + 14;
  return (
    <g>
      <rect x={x - w / 2} y={y - 9} width={w} height={17} rx={8.5}
        fill="#ffffff" stroke={GREEN_MID} strokeWidth="0.7" />
      <text x={x} y={y + 3} textAnchor="middle" fontFamily="ui-monospace, monospace"
        fontSize="8" fontWeight="700" letterSpacing="0.6" fill={GREEN_STRONG}>{label}</text>
    </g>
  );
}

function Flow({ points }: { points: P3[] }) {
  const ends = [points[0], points[points.length - 1]].map(p => iso(...p));
  return (
    <g>
      <polyline className="mkt-edge-animated" points={pp(...points)}
        fill="none" stroke={GREEN} strokeWidth="1" opacity="0.85" />
      {ends.map(([x, y], i) => (
        <circle key={`fn${i}`} cx={x} cy={y} r="2" fill="#ffffff" stroke={GREEN} strokeWidth="1" />
      ))}
    </g>
  );
}

export function SqlVisual() {
  const drum = { cx: 0, cy: 0, r: 2.3, h: 3.4 };
  const editor = { x0: -6.4, y0: 0.4, w: 2.6, d: 2.6, h: 0.16 };
  const result = { x0: 3, y0: 2.2, w: 2.8, d: 2.6, h: 0.16 };
  const drumTop = iso(drum.cx, drum.cy, drum.h);
  const editorTop = iso(editor.x0 + editor.w / 2, editor.y0 + editor.d / 2, editor.h + 0.9);
  const resultTop = iso(result.x0 + result.w / 2, result.y0 + result.d / 2, result.h + 0.9);

  return (
    <svg
      viewBox="30 215 400 355"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 h-full w-full"
      style={{ filter: "drop-shadow(0 10px 18px rgba(5,150,105,0.12))" }}
    >
      <defs>
        <linearGradient id="sqlSide" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(16,185,129,0.20)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.6)" />
        </linearGradient>
        <radialGradient id="sqlTop" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(167,243,208,0.85)" />
          <stop offset="1" stopColor="rgba(255,255,255,0.9)" />
        </radialGradient>
      </defs>

      {}
      <EditorSheet {...editor} z={0} />
      <Chip at={editorTop} label="QUERY" />

      {}
      <DbCylinder cx={drum.cx} cy={drum.cy} z0={0} r={drum.r} h={drum.h} rings={4} />
      <Chip at={[drumTop[0], drumTop[1] - 22]} label="SANDBOX" />

      {}
      <ResultSheet {...result} z={0} rows={[true, true, false, true]} />
      <Chip at={resultTop} label="CHECK" />

      {}
      <Flow points={[[editor.x0 + editor.w + 0.1, editor.y0 + editor.d / 2, 0.1], [-drum.r + 0.1, 0, 0.1]]} />
      <Flow points={[[drum.r * 0.6, drum.r * 0.6, 0.1], [result.x0 + 0.2, result.y0 + result.d / 2, 0.1]]} />
    </svg>
  );
}
