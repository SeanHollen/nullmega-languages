import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AssessmentRecord } from "../../utils/history";
import { deltaColor } from "../../utils/colors";
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
  renderTooltip,
  shortDate,
} from "./chartCommon";

interface RatingPoint {
  t: number;
  rating: number;
  title: string;
}

interface Props {
  history: (AssessmentRecord & { completedAt: number })[];
  color: string;
  label: string;
  language: string;
}

export function RatingOverTimeChart({ history, color, label, language }: Props) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);

  const points: RatingPoint[] = history
    .filter((r) => typeof r.ratingAfter === `number`)
    .sort((a, b) => a.completedAt - b.completedAt)
    .map((r) => ({ t: r.completedAt, rating: r.ratingAfter as number, title: r.title }));

  const hasData = points.length > 0;
  const tMin = hasData ? points[0].t : 0;
  const tMax = hasData ? points[points.length - 1].t : 0;
  const tSpan = Math.max(tMax - tMin, 1);
  const ratingMin = hasData ? Math.min(...points.map((p) => p.rating)) : 0;
  const ratingMax = hasData ? Math.max(...points.map((p) => p.rating)) : 100;
  const yLow = Math.max(1, Math.floor(ratingMin - 5));
  const yHigh = Math.min(100, Math.ceil(ratingMax + 5));
  const ySpan = Math.max(yHigh - yLow, 1);
  const yTicks = [yLow, Math.round((yLow + yHigh) / 2), yHigh];

  function x(ts: number): number {
    if (tSpan === 0) return PAD_L + INNER_W / 2;
    return PAD_L + ((ts - tMin) / tSpan) * INNER_W;
  }
  function y(rating: number): number {
    return PAD_T + INNER_H - ((rating - yLow) / ySpan) * INNER_H;
  }

  const latest = hasData ? points[points.length - 1].rating : null;
  const first = hasData ? points[0].rating : null;
  const delta = latest !== null && first !== null ? latest - first : 0;

  return (
    <ChartCard
      title={t(`Rating over time — {{language}}`, { language })}
      right={
        hasData ? (
          <div className="text-sm">
            <span className="text-gray-500">{t(`Latest:`)} </span>
            <span className="font-semibold text-gray-800">{latest}</span>
            {first !== latest && (
              <span className={`ml-2 text-xs font-medium ${deltaColor(delta)}`}>
                {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                {` `}
                {t(`overall`)}
              </span>
            )}
          </div>
        ) : null
      }
    >
      {hasData ? (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={t(`{{label}} rating chart`, { label: t(label) })}
        >
          <ChartFrame ticks={yTicks} toY={y} />
          <text x={PAD_L} y={CHART_HEIGHT - PAD_B + 18} className="fill-gray-400" fontSize="11">
            {new Date(tMin).toLocaleDateString()}
          </text>
          <text
            x={CHART_WIDTH - PAD_R}
            y={CHART_HEIGHT - PAD_B + 18}
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
              <circle cx={x(p.t)} cy={y(p.rating)} r={hovered === i ? 5 : 3} fill={color} />
              <circle
                cx={x(p.t)}
                cy={y(p.rating)}
                r="10"
                fill="transparent"
                style={{ cursor: `pointer` }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            </g>
          ))}
          {hovered !== null &&
            renderTooltip(x(points[hovered].t), y(points[hovered].rating), [
              shortDate(points[hovered].t),
              t(`Rating {{rating}}`, { rating: points[hovered].rating }),
              points[hovered].title || t(`Untitled`),
            ])}
        </svg>
      ) : (
        <p className="text-sm text-gray-400 italic py-8 text-center">
          {t(`No rated {{label}} exercises yet for {{language}}.`, {
            label: t(label).toLowerCase(),
            language,
          })}
        </p>
      )}

      {hasData && (
        <p className="text-xs text-gray-400 pt-2 border-t border-gray-50">
          {points.length === 1
            ? t(`{{count}} rated exercise`, { count: points.length })
            : t(`{{count}} rated exercises`, { count: points.length })}
        </p>
      )}
    </ChartCard>
  );
}
