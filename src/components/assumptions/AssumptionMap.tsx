// The assumption map (BRIEF section 6.2): importance (up) against evidence (right), drawn as plain SVG.
// Top left is important with little proof, labeled "Test next". Each dot links to the assumption.

export type MapPoint = { id: string; n: number; statement: string; importance: number; evidence: number; status: string };

const W = 640;
const H = 460;
const PAD = { left: 64, right: 16, top: 16, bottom: 56 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;
// scores run 1 to 5; leave half a step of room at each edge
const x = (evidence: number) => PAD.left + ((evidence - 0.5) / 5) * PW;
const y = (importance: number) => PAD.top + ((5.5 - importance) / 5) * PH;

export const STATUS_FILL: Record<string, string> = {
  untested: "var(--color-stone-500)",
  testing: "var(--color-amber-700)",
  supported: "var(--color-green-700)",
  refuted: "var(--color-red-700)",
  retired: "var(--color-stone-300)",
};

export function AssumptionMap({ points }: { points: MapPoint[] }) {
  // spread dots that share a spot in a small ring so each one stays clickable
  const groups = new Map<string, MapPoint[]>();
  for (const p of points) {
    const key = `${p.evidence}-${p.importance}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const placed = [...groups.values()].flatMap((g) =>
    g.map((p, i) => {
      const angle = (2 * Math.PI * i) / g.length - Math.PI / 2;
      const r = g.length > 1 ? 15 + g.length : 0;
      return { ...p, cx: x(p.evidence) + r * Math.cos(angle), cy: y(p.importance) + r * Math.sin(angle) };
    }),
  );
  const midX = x(3);
  const midY = y(3);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-3xl" role="img" aria-label="Assumption map: importance against evidence">
      {/* quadrants */}
      <rect x={PAD.left} y={PAD.top} width={midX - PAD.left} height={midY - PAD.top} fill="color-mix(in oklab, var(--color-accent) 14%, transparent)" />
      <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="var(--color-line)" />
      <line x1={midX} y1={PAD.top} x2={midX} y2={PAD.top + PH} stroke="var(--color-line)" strokeDasharray="4 4" />
      <line x1={PAD.left} y1={midY} x2={PAD.left + PW} y2={midY} stroke="var(--color-line)" strokeDasharray="4 4" />
      <text x={PAD.left + 10} y={PAD.top + 22} fill="var(--color-accent)" fontSize="15" fontWeight="600">
        Test next
      </text>
      <text x={PAD.left + 10} y={PAD.top + 38} fill="var(--color-muted)" fontSize="11">
        Important, little proof
      </text>
      <text x={PAD.left + PW - 10} y={PAD.top + 22} fill="var(--color-muted)" fontSize="11" textAnchor="end">
        Important, well proven
      </text>
      <text x={PAD.left + 10} y={PAD.top + PH - 10} fill="var(--color-muted)" fontSize="11">
        Less important, little proof
      </text>
      <text x={PAD.left + PW - 10} y={PAD.top + PH - 10} fill="var(--color-muted)" fontSize="11" textAnchor="end">
        Less important, well proven
      </text>

      {/* axes */}
      {[1, 2, 3, 4, 5].map((n) => (
        <g key={n} fill="var(--color-muted)" fontSize="11">
          <text x={x(n)} y={PAD.top + PH + 16} textAnchor="middle">
            {n}
          </text>
          <text x={PAD.left - 10} y={y(n) + 4} textAnchor="end">
            {n}
          </text>
        </g>
      ))}
      <text x={PAD.left + PW / 2} y={H - 12} fill="var(--color-ink)" fontSize="12" textAnchor="middle">
        Evidence: how much proof we have
      </text>
      <text transform={`translate(18 ${PAD.top + PH / 2}) rotate(-90)`} fill="var(--color-ink)" fontSize="12" textAnchor="middle">
        Importance: how much the business depends on it
      </text>

      {/* dots */}
      {placed.map((p) => (
        <a key={p.id} href={`/assumptions/${p.id}`}>
          <title>{`${p.n}. ${p.statement} (importance ${p.importance}, evidence ${p.evidence}, ${p.status})`}</title>
          <circle cx={p.cx} cy={p.cy} r={11} fill={STATUS_FILL[p.status] ?? STATUS_FILL.untested} stroke="var(--color-paper)" strokeWidth={2} />
          <text x={p.cx} y={p.cy + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--color-paper)">
            {p.n}
          </text>
        </a>
      ))}
    </svg>
  );
}
