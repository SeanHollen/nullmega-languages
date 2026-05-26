// Shared chart primitives for the stats charts. Each chart in this folder
// renders into a 600x280 viewBox with a consistent inner padding, so the y/x
// axis math, tooltip box, and toggle/chart-card chrome can all live here.

export const CHART_WIDTH = 600;
export const CHART_HEIGHT = 280;
export const PAD_L = 36;
export const PAD_R = 12;
export const PAD_T = 12;
export const PAD_B = 36;
export const INNER_W = CHART_WIDTH - PAD_L - PAD_R;
export const INNER_H = CHART_HEIGHT - PAD_T - PAD_B;

export function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: `short`, day: `numeric` });
}

export function renderTooltip(ax: number, ay: number, lines: string[]) {
  const lineHeight = 14;
  const padX = 8;
  const padY = 6;
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const w = Math.max(60, longest * 6.2 + padX * 2);
  const h = lines.length * lineHeight + padY * 2 - 2;
  const above = ay - h - 10 >= PAD_T;
  const ty = above ? ay - h - 10 : ay + 10;
  const tx = Math.max(PAD_L, Math.min(CHART_WIDTH - PAD_R - w, ax - w / 2));
  return (
    <g pointerEvents="none">
      <rect x={tx} y={ty} width={w} height={h} rx="4" fill="#1f2937" opacity="0.95" />
      <text x={tx + padX} y={ty + padY + 10} fill="white" fontSize="11">
        {lines.map((line, i) => (
          <tspan key={i} x={tx + padX} dy={i === 0 ? 0 : lineHeight}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

// Dashed horizontal gridlines + their y-axis tick labels, plus the left/bottom
// axis lines. Every chart uses this exact frame.
export function ChartFrame({
  ticks,
  toY,
  formatTick,
}: {
  ticks: number[];
  toY: (value: number) => number;
  formatTick?: (tick: number) => string;
}) {
  const fmt = formatTick ?? ((tick) => `${tick}`);
  return (
    <>
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD_L}
            x2={CHART_WIDTH - PAD_R}
            y1={toY(tick)}
            y2={toY(tick)}
            stroke="#e5e7eb"
            strokeDasharray="3 3"
          />
          <text
            x={PAD_L - 6}
            y={toY(tick) + 4}
            textAnchor="end"
            className="fill-gray-400"
            fontSize="11"
          >
            {fmt(tick)}
          </text>
        </g>
      ))}
      <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={CHART_HEIGHT - PAD_B} stroke="#e5e7eb" />
      <line
        x1={PAD_L}
        x2={CHART_WIDTH - PAD_R}
        y1={CHART_HEIGHT - PAD_B}
        y2={CHART_HEIGHT - PAD_B}
        stroke="#e5e7eb"
      />
    </>
  );
}

// Button-group toggle used by every chart that has a mode switch.
export function ChartToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (next: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {options.map(([mode, label]) => (
        <button
          key={mode}
          onClick={() => onChange(mode)}
          className={`text-xs px-3 py-1 rounded-md transition cursor-pointer ${
            value === mode
              ? `bg-green-100 text-green-700 font-medium`
              : `text-gray-500 hover:bg-gray-100`
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// White rounded card that wraps every chart, with the heading row.
export function ChartCard({
  title,
  right,
  trailing,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  // Rendered just below the heading row (e.g. a right-aligned "Total: 42" summary).
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <p className="text-sm text-gray-500">{title}</p>
        {right}
      </div>
      {trailing}
      {children}
    </div>
  );
}
