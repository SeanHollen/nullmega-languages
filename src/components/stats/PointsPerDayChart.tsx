import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AssessmentRecord } from "../../utils/history";
import { pointsForRecord } from "../../utils/history";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  ChartCard,
  ChartFrame,
  INNER_H,
  INNER_W,
  PAD_B,
  PAD_L,
  PAD_R,
  PAD_T,
  dayStart,
  renderTooltip,
  shortDate,
} from "./chartCommon";

const DAY_MS = 24 * 60 * 60 * 1000;

interface DailyPoint {
  t: number;
  points: number;
  count: number;
}

interface Props {
  history: (AssessmentRecord & { completedAt: number })[];
  color: string;
  label: string;
  language: string;
}

export function PointsPerDayChart({ history, color, label, language }: Props) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);

  const dailyMap = new Map<number, { points: number; count: number }>();
  for (const r of history) {
    const day = dayStart(r.completedAt);
    const prev = dailyMap.get(day) ?? { points: 0, count: 0 };
    dailyMap.set(day, { points: prev.points + pointsForRecord(r), count: prev.count + 1 });
  }
  const dailyPoints: DailyPoint[] = [...dailyMap.entries()]
    .map(([ts, agg]) => ({ t: ts, points: agg.points, count: agg.count }))
    .sort((a, b) => a.t - b.t);
  const hasDailyData = dailyPoints.length > 0;
  const totalPoints = dailyPoints.reduce((sum, d) => sum + d.points, 0);
  const maxDailyPoints = hasDailyData ? Math.max(...dailyPoints.map((d) => d.points)) : 0;
  const pHigh = Math.max(10, Math.ceil(maxDailyPoints * 1.1));
  const dayTMin = hasDailyData ? dailyPoints[0].t : 0;
  const dayTMax = hasDailyData ? dailyPoints[dailyPoints.length - 1].t : 0;
  const totalDaySlots = hasDailyData
    ? Math.max(1, Math.round((dayTMax - dayTMin) / DAY_MS) + 1)
    : 1;
  const dayWidth = INNER_W / totalDaySlots;
  const barWidth = Math.max(2, dayWidth * 0.7);
  const pTicks = [0, Math.round(pHigh / 2), pHigh];

  function xDay(ts: number): number {
    const dayIndex = Math.round((ts - dayTMin) / DAY_MS);
    return PAD_L + dayIndex * dayWidth + dayWidth / 2;
  }
  function yPoints(p: number): number {
    return PAD_T + INNER_H - (p / pHigh) * INNER_H;
  }

  return (
    <ChartCard
      title={t(`Points per day — {{language}}`, { language })}
      right={
        hasDailyData ? (
          <div className="text-sm">
            <span className="text-gray-500">{t(`Total:`)} </span>
            <span className="font-semibold text-gray-800">{totalPoints.toFixed(0)}</span>
          </div>
        ) : null
      }
    >
      {hasDailyData ? (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={t(`{{label}} points-per-day chart`, { label: t(label) })}
        >
          <ChartFrame ticks={pTicks} toY={yPoints} />
          <text x={PAD_L} y={CHART_HEIGHT - PAD_B + 18} className="fill-gray-400" fontSize="11">
            {new Date(dayTMin).toLocaleDateString()}
          </text>
          <text
            x={CHART_WIDTH - PAD_R}
            y={CHART_HEIGHT - PAD_B + 18}
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
                  opacity={hovered === i ? 0.8 : 1}
                  rx="2"
                />
                <rect
                  x={xDay(d.t) - hitW / 2}
                  y={PAD_T}
                  width={hitW}
                  height={INNER_H}
                  fill="transparent"
                  style={{ cursor: `pointer` }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            );
          })}
          {hovered !== null &&
            renderTooltip(xDay(dailyPoints[hovered].t), yPoints(dailyPoints[hovered].points), [
              shortDate(dailyPoints[hovered].t),
              t(`{{points}} pts`, { points: dailyPoints[hovered].points.toFixed(0) }),
              dailyPoints[hovered].count === 1
                ? t(`{{count}} exercise`, { count: dailyPoints[hovered].count })
                : t(`{{count}} exercises`, { count: dailyPoints[hovered].count }),
            ])}
        </svg>
      ) : (
        <p className="text-sm text-gray-400 italic py-8 text-center">
          {t(`No {{label}} exercises yet for {{language}}.`, {
            label: t(label).toLowerCase(),
            language,
          })}
        </p>
      )}

      {hasDailyData && (
        <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
          {dailyPoints.length === 1
            ? t(`{{count}} day of activity`, { count: dailyPoints.length })
            : t(`{{count}} days of activity`, { count: dailyPoints.length })}
        </p>
      )}
    </ChartCard>
  );
}
