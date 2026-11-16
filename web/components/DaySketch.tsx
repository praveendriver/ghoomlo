/**
 * A hand-drawn-style sketch for one day: numbered pins in visit order along a
 * dotted route. It is decorative and deliberately not geographic — we hold no
 * verified coordinates — so it is labelled "not to scale" and drawn from a
 * seed rather than from locations.
 */

function seeded(seedText: string): () => number {
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i++) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 360;
const H = 190;
const r1 = (n: number) => Math.round(n * 10) / 10;

/** Smooth curve through the points (Catmull-Rom converted to cubic Béziers). */
function routePath(points: [number, number][]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    d += ` C ${r1(p1[0] + (p2[0] - p0[0]) / 6)} ${r1(p1[1] + (p2[1] - p0[1]) / 6)}, ${r1(p2[0] - (p3[0] - p1[0]) / 6)} ${r1(p2[1] - (p3[1] - p1[1]) / 6)}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}

export function DaySketch({ id, seed, stops }: { id: string; seed: string; stops: string[] }) {
  if (stops.length === 0) return null;
  const rand = seeded(seed);
  const between = (lo: number, hi: number) => r1(lo + rand() * (hi - lo));

  // Pins march left to right, weaving up and down, so the visit order reads naturally.
  // They stay in the middle band because wide screens crop the top and bottom of the sketch.
  const n = stops.length;
  const points: [number, number][] = stops.map((_, i) => {
    const x = n === 1 ? W / 2 : 44 + (i * (W - 88)) / (n - 1);
    const high = (i + (rand() > 0.5 ? 0 : 1)) % 2 === 0;
    return [r1(x + between(-8, 8)), high ? between(80, 98) : between(120, 146)];
  });

  const riverY = between(30, 150);
  const river = `M -10 ${riverY} C ${between(60, 110)} ${between(10, 170)}, ${between(180, 250)} ${between(10, 170)}, ${W + 10} ${between(30, 160)}`;
  const roads = Array.from({ length: 6 }, (_, i) =>
    i % 2 === 0
      ? `M -10 ${between(10, H - 10)} Q ${between(100, 260)} ${between(0, H)} ${W + 10} ${between(10, H - 10)}`
      : `M ${between(20, W - 20)} -10 Q ${between(40, W - 40)} ${between(60, 130)} ${between(20, W - 20)} ${H + 10}`,
  );
  const parks = Array.from({ length: 4 }, () => ({
    cx: between(20, W - 20),
    cy: between(20, H - 20),
    rx: between(22, 46),
    ry: between(14, 30),
    rot: between(-30, 30),
  }));
  const trees = Array.from({ length: 9 }, () => [between(12, W - 12), between(14, H - 14)] as const);
  const label = `Sketch of the day's stops in order, not to scale: ${stops.map((s, i) => `${i + 1}. ${s}`).join("; ")}`;

  return (
    <figure className="sketch">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id={`${id}-wobble`} x="-5%" y="-5%" width="110%" height="110%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed={Math.floor(rand() * 90) + 1} result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" />
          </filter>
        </defs>
        <rect width={W} height={H} fill="#efe8da" />
        <g filter={`url(#${id}-wobble)`}>
          {parks.map((p, i) => (
            <ellipse key={i} cx={p.cx} cy={p.cy} rx={p.rx} ry={p.ry} transform={`rotate(${p.rot} ${p.cx} ${p.cy})`} fill={i === 3 ? "#f4e3b5" : "#d3e2cc"} />
          ))}
          {roads.map((d, i) => (
            <path key={i} d={d} fill="none" stroke="#fffdf8" strokeWidth={i < 2 ? 7 : 4} strokeLinecap="round" />
          ))}
          <path d={river} fill="none" stroke="#b7d3e4" strokeWidth="13" strokeLinecap="round" />
          {trees.map(([x, y], i) => (
            <path key={i} d={`M ${x} ${y} l 0 -5 m -3 1 a 3.2 3.2 0 1 1 6 0 a 3.2 3.2 0 1 1 -6 0`} fill="none" stroke="#6f927a" strokeWidth="1.2" strokeLinecap="round" />
          ))}
          <path d={routePath(points)} fill="none" stroke="#15211c" strokeWidth="2.2" strokeDasharray="1 7" strokeLinecap="round" />
        </g>
        {points.map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y + 1} rx="6" ry="2.2" fill="rgba(21,33,28,0.22)" />
            <path d={`M ${x} ${y} c -9 -11 -11.5 -15 -11.5 -20.5 a 11.5 11.5 0 1 1 23 0 c 0 5.5 -2.5 9.5 -11.5 20.5 z`} fill="#15211c" />
            <circle cx={x} cy={r1(y - 20.5)} r="7.6" fill="#fffdf8" />
            <text x={x} y={r1(y - 16.6)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#15211c" fontFamily="var(--body)">
              {i + 1}
            </text>
          </g>
        ))}
      </svg>
      <figcaption aria-hidden="true">sketch · not to scale</figcaption>
    </figure>
  );
}
