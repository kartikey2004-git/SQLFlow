const CX = 255, CY = 385, S = 30;
const cos30 = Math.cos(Math.PI / 6);
const sin30 = 0.5;
const W = 9, D = 3;

const BLUE = "#2563eb";
const BLUE_MID = "rgba(37,99,235,0.55)";
const BLUE_DIM = "rgba(37,99,235,0.30)";
const DIM = "rgba(148,163,184,0.22)";
const FILL_TOP = "rgba(37,99,235,0.07)";
const FILL_TOP_KEY = "rgba(37,99,235,0.14)";
const FILL_SIDE = "rgba(15,23,42,0.35)";
const FILL_SIDE_BLUE = "rgba(37,99,235,0.08)";

function iso(x: number, y: number, z: number): [number, number] {
  return [
    CX + (x - y) * cos30 * S,
    CY + (x + y) * sin30 * S - z * S,
  ];
}
function pt(x: number, y: number, z: number) {
  return iso(x, y, z).join(",");
}
function pp(...c: [number, number, number][]) {
  return c.map(([x, y, z]) => pt(x, y, z)).join(" ");
}

type SlabProps = {
  x0?: number; y0?: number; z0: number;
  w?: number; d?: number; h: number;
  stroke: string; topFill?: string; sideFill?: string; strokeWidth?: number;
};

function Slab({ x0 = 0, y0 = 0, z0, w = W, d = D, h, stroke, topFill = FILL_TOP, sideFill = FILL_SIDE, strokeWidth = 0.8 }: SlabProps) {
  return (
    <g>
      {/* Right face (x = x0+w) */}
      <polygon points={pp([x0+w,y0,z0],[x0+w,y0+d,z0],[x0+w,y0+d,z0+h],[x0+w,y0,z0+h])}
        fill={sideFill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Front face (y = y0) */}
      <polygon points={pp([x0,y0,z0],[x0+w,y0,z0],[x0+w,y0,z0+h],[x0,y0,z0+h])}
        fill={sideFill} stroke={stroke} strokeWidth={strokeWidth} />
      {/* Top face */}
      <polygon points={pp([x0,y0,z0+h],[x0+w,y0,z0+h],[x0+w,y0+d,z0+h],[x0,y0+d,z0+h])}
        fill={topFill} stroke={stroke} strokeWidth={strokeWidth} />
    </g>
  );
}

function ConnLine({ x, y, z1, z2 }: { x: number; y: number; z1: number; z2: number }) {
  const [x1, y1] = iso(x, y, z1);
  const [x2, y2] = iso(x, y, z2);
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BLUE} strokeWidth="0.6" strokeDasharray="3,3" opacity="0.65" />;
}

const zFloors = [0, 2.0, 3.85, 5.55, 7.15, 8.7];
const FT = 0.25;
const FT_ROOF = 0.42;
const zTop = zFloors[5] + FT_ROOF;

export function ArchitectureVisual() {
  return (
    <svg
      viewBox="50 80 490 560"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute inset-0 h-full w-full"
      style={{ filter: "drop-shadow(0 0 2px rgba(37,99,235,0.18))" }}
    >
      {/* Vertical dashed connector lines at corners + mid-span */}
      {[0, W].flatMap(x => [0, D].map(y => (
        <ConnLine key={`c${x}${y}`} x={x} y={y} z1={0} z2={zTop} />
      )))}
      <ConnLine x={3} y={0} z1={0} z2={zTop} />
      <ConnLine x={6} y={0} z1={0} z2={zTop} />
      <ConnLine x={3} y={D} z1={0} z2={zTop} />
      <ConnLine x={6} y={D} z1={0} z2={zTop} />

      {/* ── Floor 0: Foundation ── */}
      <Slab z0={zFloors[0]} h={FT} stroke={DIM} topFill="rgba(15,23,42,0.6)" />
      {/* Footing grid on top of foundation */}
      {Array.from({ length: 8 }, (_, i) =>
        Array.from({ length: 4 }, (_, j) => {
          const fx = i * (W / 7) + 0.1;
          const fy = j * (D / 3) + 0.05;
          return (
            <Slab key={`ft${i}${j}`}
              x0={fx} y0={fy} z0={FT} w={0.5} d={0.35} h={0.18}
              stroke={BLUE_DIM} topFill="rgba(37,99,235,0.22)"
              sideFill="rgba(37,99,235,0.07)" strokeWidth={0.6} />
          );
        })
      )}

      {/* ── Floor 1: Dense structural ── */}
      <Slab z0={zFloors[1]} h={FT} stroke={DIM} />
      {/* Interior partition walls */}
      <Slab x0={0} y0={0} z0={zFloors[1]} w={0.08} d={D} h={FT * 3}
        stroke={DIM} topFill={FILL_TOP} sideFill="rgba(148,163,184,0.08)" strokeWidth={0.5} />
      <Slab x0={3} y0={0} z0={zFloors[1]} w={0.08} d={D} h={FT * 3}
        stroke={DIM} topFill={FILL_TOP} sideFill="rgba(148,163,184,0.08)" strokeWidth={0.5} />
      <Slab x0={6} y0={0} z0={zFloors[1]} w={0.08} d={D} h={FT * 3}
        stroke={DIM} topFill={FILL_TOP} sideFill="rgba(148,163,184,0.08)" strokeWidth={0.5} />
      <Slab x0={W} y0={0} z0={zFloors[1]} w={0.08} d={D} h={FT * 3}
        stroke={DIM} topFill={FILL_TOP} sideFill="rgba(148,163,184,0.08)" strokeWidth={0.5} />
      {/* Columns */}
      {[1.2, 4.2, 7.2].flatMap(cx2 => [0.5, 2.0].map(cy2 => (
        <Slab key={`dc${cx2}${cy2}`} x0={cx2} y0={cy2} z0={zFloors[1] + FT}
          w={0.35} d={0.3} h={0.85} stroke={DIM}
          topFill="rgba(100,120,160,0.1)" sideFill="rgba(80,100,140,0.1)" strokeWidth={0.5} />
      )))}

      {/* ── Floor 2: Open structural ── */}
      <Slab z0={zFloors[2]} h={FT} stroke={DIM} />
      {/* Sparser columns */}
      {[2.0, 7.0].flatMap(cx2 => [0.6, 2.1].map(cy2 => (
        <Slab key={`oc${cx2}${cy2}`} x0={cx2} y0={cy2} z0={zFloors[2] + FT}
          w={0.35} d={0.3} h={0.7} stroke={DIM}
          topFill="rgba(100,120,160,0.09)" sideFill="rgba(80,100,140,0.09)" strokeWidth={0.5} />
      )))}

      {/* ── Floor 3: Floor-plan ── */}
      <Slab z0={zFloors[3]} h={FT} stroke={BLUE_DIM} topFill={FILL_TOP_KEY} sideFill={FILL_SIDE_BLUE} />
      {/* Room partition */}
      <Slab x0={3.2} y0={0} z0={zFloors[3]} w={0.08} d={D} h={FT * 2.5}
        stroke={BLUE_DIM} topFill={FILL_TOP} sideFill="rgba(37,99,235,0.1)" strokeWidth={0.6} />
      {/* Inner horizontal wall */}
      <Slab x0={0} y0={1.1} z0={zFloors[3]} w={3.1} d={0.08} h={FT * 2.5}
        stroke={BLUE_DIM} topFill={FILL_TOP} sideFill="rgba(37,99,235,0.1)" strokeWidth={0.6} />
      {/* Highlighted room outline */}
      <polygon
        points={pp([3.2, 0, zFloors[3]+FT], [W, 0, zFloors[3]+FT], [W, D, zFloors[3]+FT], [3.2, D, zFloors[3]+FT])}
        fill="rgba(37,99,235,0.09)" stroke={BLUE} strokeWidth="0.75" />

      {/* ── Floor 4: Thin structural ── */}
      <Slab z0={zFloors[4]} h={FT * 0.65} stroke={DIM} topFill="rgba(37,99,235,0.05)" />

      {/* ── Left towers ── */}
      {/* Tall tower */}
      <Slab x0={-2.9} y0={-0.2} z0={0} w={1.0} d={1.3} h={6.2}
        stroke={DIM} topFill="rgba(37,99,235,0.06)" sideFill="rgba(15,23,42,0.4)" />
      {/* Short tower */}
      <Slab x0={-2.9} y0={1.6} z0={0} w={1.0} d={1.2} h={4.4}
        stroke={DIM} topFill="rgba(37,99,235,0.06)" sideFill="rgba(15,23,42,0.4)" />

      {/* ── Floor 5: Roof slab (most prominent) ── */}
      <Slab z0={zFloors[5]} h={FT_ROOF} stroke={BLUE} topFill={FILL_TOP_KEY}
        sideFill={FILL_SIDE_BLUE} strokeWidth={1.1} />
      {/* Roof cut detail line */}
      <line
        x1={iso(2.2, 0, zTop)[0]} y1={iso(2.2, 0, zTop)[1]}
        x2={iso(2.2, D, zTop)[0]} y2={iso(2.2, D, zTop)[1]}
        stroke={BLUE_MID} strokeWidth="0.75" />

      {/* ── Right small tower ── */}
      <Slab x0={W + 0.7} y0={D + 0.4} z0={0} w={0.9} d={0.9} h={2.4}
        stroke={DIM} topFill="rgba(37,99,235,0.06)" sideFill="rgba(15,23,42,0.38)" />
    </svg>
  );
}
