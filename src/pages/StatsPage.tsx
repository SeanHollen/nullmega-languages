import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import type { Mode } from "../hooks/useAbility";
import { useLanguage } from "../contexts/LanguageContext";
import { getHistory, pointsForRecord } from "../utils/history";
import { deltaColor } from "../utils/colors";

const MODE_LABELS: Record<Mode, string> = {
  reading: `Reading`,
  writing: `Writing`,
  listening: `Listening`,
  pronunciation: `Pronunciation`,
};

const MODE_COLORS: Record<Mode, string> = {
  reading: `#16a34a`,
  writing: `#0ea5e9`,
  listening: `#f59e0b`,
  pronunciation: `#a855f7`,
};

const VALID_MODES: Mode[] = [`reading`, `writing`, `listening`, `pronunciation`];

interface Point {
  t: number;
  rating: number;
  title: string;
}

interface DailyPoint {
  t: number;
  points: number;
  count: number;
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

const WIDTH = 600;
const HEIGHT = 280;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 28;

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function renderTooltip(ax: number, ay: number, lines: string[]) {
  const lineHeight = 14;
  const padX = 8;
  const padY = 6;
  const longest = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const w = Math.max(60, longest * 6.2 + padX * 2);
  const h = lines.length * lineHeight + padY * 2 - 2;
  const above = ay - h - 10 >= PAD_T;
  const ty = above ? ay - h - 10 : ay + 10;
  const tx = Math.max(PAD_L, Math.min(WIDTH - PAD_R - w, ax - w / 2));
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

export function StatsPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { mode: modeParam } = useParams<{ mode: string }>();
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  if (!modeParam || !VALID_MODES.includes(modeParam as Mode)) {
    return (
      <div className="min-h-screen bg-green-100 py-10 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => navigate(`/`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer mb-6 flex items-center gap-2"
          >
            <FaArrowLeft />
            <span>{`Home`}</span>
          </button>
          <p className="text-gray-500">{`Unknown mode.`}</p>
        </div>
      </div>
    );
  }

  const mode = modeParam as Mode;
  const color = MODE_COLORS[mode];
  const label = MODE_LABELS[mode];

  const history = getHistory(mode, language).filter(
    (r): r is typeof r & { completedAt: number } => typeof r.completedAt === "number",
  );

  const points: Point[] = history
    .filter((r) => typeof r.ratingAfter === `number`)
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((r) => ({ t: r.completedAt, rating: r.ratingAfter as number, title: r.title }));

  const hasData = points.length > 0;

  const dailyMap = new Map<number, { points: number; count: number }>();
  for (const r of history) {
    const day = dayStart(r.completedAt);
    const prev = dailyMap.get(day) ?? { points: 0, count: 0 };
    dailyMap.set(day, { points: prev.points + pointsForRecord(r), count: prev.count + 1 });
  }
  const dailyPoints: DailyPoint[] = [...dailyMap.entries()]
    .map(([t, agg]) => ({ t, points: agg.points, count: agg.count }))
    .sort((a, b) => a.t - b.t);
  const hasDailyData = dailyPoints.length > 0;
  const totalPoints = dailyPoints.reduce((sum, d) => sum + d.points, 0);
  const maxDailyPoints = hasDailyData ? Math.max(...dailyPoints.map((d) => d.points)) : 0;
  const pHigh = Math.max(10, Math.ceil(maxDailyPoints * 1.1));
  const dayTMin = hasDailyData ? dailyPoints[0].t : 0;
  const dayTMax = hasDailyData ? dailyPoints[dailyPoints.length - 1].t : 0;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const totalDaySlots = hasDailyData
    ? Math.max(1, Math.round((dayTMax - dayTMin) / DAY_MS) + 1)
    : 1;

  const tMin = hasData ? points[0].t : 0;
  const tMax = hasData ? points[points.length - 1].t : 0;
  const tSpan = Math.max(tMax - tMin, 1);

  const ratingMin = hasData ? Math.min(...points.map((p) => p.rating)) : 0;
  const ratingMax = hasData ? Math.max(...points.map((p) => p.rating)) : 100;
  const yLow = Math.max(1, Math.floor(ratingMin - 5));
  const yHigh = Math.min(100, Math.ceil(ratingMax + 5));
  const ySpan = Math.max(yHigh - yLow, 1);

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;

  function x(t: number): number {
    if (tSpan === 0) return PAD_L + innerW / 2;
    return PAD_L + ((t - tMin) / tSpan) * innerW;
  }

  function y(rating: number): number {
    return PAD_T + innerH - ((rating - yLow) / ySpan) * innerH;
  }

  const dayWidth = innerW / totalDaySlots;

  function xDay(t: number): number {
    const dayIndex = Math.round((t - dayTMin) / DAY_MS);
    return PAD_L + dayIndex * dayWidth + dayWidth / 2;
  }

  function yPoints(p: number): number {
    return PAD_T + innerH - (p / pHigh) * innerH;
  }

  const barWidth = Math.max(2, dayWidth * 0.7);
  const pTicks = [0, Math.round(pHigh / 2), pHigh];

  const yTicks = [yLow, Math.round((yLow + yHigh) / 2), yHigh];
  const latest = hasData ? points[points.length - 1].rating : null;
  const first = hasData ? points[0].rating : null;
  const delta = latest !== null && first !== null ? latest - first : 0;

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(`/${mode}`)}
            className="text-gray-400 hover:text-gray-600 transition cursor-pointer"
          >
            <FaArrowLeft />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">{`${label} Stats`}</h1>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <p className="text-sm text-gray-500">{`Rating over time — ${language}`}</p>
            {hasData && (
              <div className="text-sm">
                <span className="text-gray-500">{`Latest: `}</span>
                <span className="font-semibold text-gray-800">{latest}</span>
                {first !== latest && (
                  <span className={`ml-2 text-xs font-medium ${deltaColor(delta)}`}>
                    {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                    {` overall`}
                  </span>
                )}
              </div>
            )}
          </div>

          {hasData ? (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full"
              role="img"
              aria-label={`${label} rating chart`}
            >
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD_L}
                    x2={WIDTH - PAD_R}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="#e5e7eb"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={PAD_L - 6}
                    y={y(tick) + 4}
                    textAnchor="end"
                    className="fill-gray-400"
                    fontSize="11"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={HEIGHT - PAD_B} stroke="#e5e7eb" />
              <line
                x1={PAD_L}
                x2={WIDTH - PAD_R}
                y1={HEIGHT - PAD_B}
                y2={HEIGHT - PAD_B}
                stroke="#e5e7eb"
              />

              <text x={PAD_L} y={HEIGHT - 8} className="fill-gray-400" fontSize="11">
                {new Date(tMin).toLocaleDateString()}
              </text>
              <text
                x={WIDTH - PAD_R}
                y={HEIGHT - 8}
                textAnchor="end"
                className="fill-gray-400"
                fontSize="11"
              >
                {new Date(tMax).toLocaleDateString()}
              </text>

              <polyline
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points.map((p) => `${x(p.t)},${y(p.rating)}`).join(` `)}
              />
              {points.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={x(p.t)}
                    cy={y(p.rating)}
                    r={hoveredRating === i ? 5 : 3}
                    fill={color}
                  />
                  <circle
                    cx={x(p.t)}
                    cy={y(p.rating)}
                    r="10"
                    fill="transparent"
                    style={{ cursor: `pointer` }}
                    onMouseEnter={() => setHoveredRating(i)}
                    onMouseLeave={() => setHoveredRating(null)}
                  />
                </g>
              ))}
              {hoveredRating !== null &&
                renderTooltip(x(points[hoveredRating].t), y(points[hoveredRating].rating), [
                  `${shortDate(points[hoveredRating].t)}`,
                  `Rating ${points[hoveredRating].rating}`,
                  points[hoveredRating].title || `Untitled`,
                ])}
            </svg>
          ) : (
            <p className="text-sm text-gray-400 italic py-8 text-center">
              {`No rated ${label.toLowerCase()} exercises yet for ${language}.`}
            </p>
          )}

          {hasData && (
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
              {`${points.length} rated exercise${points.length === 1 ? `` : `s`}`}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 mt-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <p className="text-sm text-gray-500">{`Points per day — ${language}`}</p>
            {hasDailyData && (
              <div className="text-sm">
                <span className="text-gray-500">{`Total: `}</span>
                <span className="font-semibold text-gray-800">{totalPoints.toFixed(0)}</span>
              </div>
            )}
          </div>

          {hasDailyData ? (
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="w-full"
              role="img"
              aria-label={`${label} points-per-day chart`}
            >
              {pTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD_L}
                    x2={WIDTH - PAD_R}
                    y1={yPoints(tick)}
                    y2={yPoints(tick)}
                    stroke="#e5e7eb"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={PAD_L - 6}
                    y={yPoints(tick) + 4}
                    textAnchor="end"
                    className="fill-gray-400"
                    fontSize="11"
                  >
                    {tick}
                  </text>
                </g>
              ))}

              <line x1={PAD_L} x2={PAD_L} y1={PAD_T} y2={HEIGHT - PAD_B} stroke="#e5e7eb" />
              <line
                x1={PAD_L}
                x2={WIDTH - PAD_R}
                y1={HEIGHT - PAD_B}
                y2={HEIGHT - PAD_B}
                stroke="#e5e7eb"
              />

              <text x={PAD_L} y={HEIGHT - 8} className="fill-gray-400" fontSize="11">
                {new Date(dayTMin).toLocaleDateString()}
              </text>
              <text
                x={WIDTH - PAD_R}
                y={HEIGHT - 8}
                textAnchor="end"
                className="fill-gray-400"
                fontSize="11"
              >
                {new Date(dayTMax).toLocaleDateString()}
              </text>

              {dailyPoints.map((d, i) => {
                const barX = xDay(d.t) - barWidth / 2;
                const barY = yPoints(d.points);
                const barH = Math.max(0, yPoints(0) - barY);
                const hitW = Math.max(dayWidth, 12);
                return (
                  <g key={d.t}>
                    <rect
                      x={barX}
                      y={barY}
                      width={barWidth}
                      height={barH}
                      fill={color}
                      opacity={hoveredDay === i ? 0.8 : 1}
                      rx="2"
                    />
                    <rect
                      x={xDay(d.t) - hitW / 2}
                      y={PAD_T}
                      width={hitW}
                      height={innerH}
                      fill="transparent"
                      style={{ cursor: `pointer` }}
                      onMouseEnter={() => setHoveredDay(i)}
                      onMouseLeave={() => setHoveredDay(null)}
                    />
                  </g>
                );
              })}
              {hoveredDay !== null &&
                renderTooltip(
                  xDay(dailyPoints[hoveredDay].t),
                  yPoints(dailyPoints[hoveredDay].points),
                  [
                    `${shortDate(dailyPoints[hoveredDay].t)}`,
                    `${dailyPoints[hoveredDay].points.toFixed(0)} pts`,
                    `${dailyPoints[hoveredDay].count} exercise${dailyPoints[hoveredDay].count === 1 ? `` : `s`}`,
                  ],
                )}
            </svg>
          ) : (
            <p className="text-sm text-gray-400 italic py-8 text-center">
              {`No ${label.toLowerCase()} exercises yet for ${language}.`}
            </p>
          )}

          {hasDailyData && (
            <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
              {`${dailyPoints.length} day${dailyPoints.length === 1 ? `` : `s`} of activity`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
