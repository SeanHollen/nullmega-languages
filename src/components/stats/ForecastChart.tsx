import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DAY } from "../../utils/studySession";
import type { SrsCardWithStatus } from "./SrsStatsView";
import { forecastDueDays } from "../../utils/srsForecast";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  ChartCard,
  ChartFrame,
  INNER_H,
  INNER_W,
  PAD_B,
  PAD_L,
  PAD_T,
  dayStart,
  renderTooltip,
  shortDate,
} from "./chartCommon";

const HORIZON_DAYS = 30;

interface Props {
  cards: SrsCardWithStatus[];
}

export function ForecastChart({ cards }: Props) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());
  const [hovered, setHovered] = useState<number | null>(null);

  const today = dayStart(now);
  const horizonMs = today + HORIZON_DAYS * DAY;

  const dayCounts = new Map<number, number>();
  for (const card of cards) {
    for (const d of forecastDueDays(card, today, horizonMs)) {
      dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1);
    }
  }
  const forecastDays: { t: number; count: number }[] = [];
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const t = today + i * DAY;
    forecastDays.push({ t, count: dayCounts.get(t) ?? 0 });
  }
  const maxDueCount = Math.max(1, ...forecastDays.map((d) => d.count));
  const high = Math.max(5, Math.ceil(maxDueCount * 1.1));
  const ticks = [0, Math.round(high / 2), high];
  const barSlot = INNER_W / forecastDays.length;
  const totalDueInWindow = forecastDays.reduce((s, d) => s + d.count, 0);

  function barX(i: number): number {
    return PAD_L + i * barSlot + barSlot / 2;
  }
  function toY(count: number): number {
    return PAD_T + INNER_H - (count / high) * INNER_H;
  }

  return (
    <ChartCard
      title={t(`Future review forecast ({{days}} days)`, { days: HORIZON_DAYS })}
      right={
        totalDueInWindow > 0 ? (
          <div className="text-sm">
            <span className="text-gray-500">{t(`Reviews due:`)} </span>
            <span className="font-semibold text-gray-800">{totalDueInWindow}</span>
          </div>
        ) : null
      }
    >
      {totalDueInWindow === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">
          {t(`No reviews scheduled in the next {{days}} days.`, { days: HORIZON_DAYS })}
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={t(`Future review forecast`)}
        >
          <ChartFrame ticks={ticks} toY={toY} />
          {forecastDays.map((d, i) => {
            const date = new Date(d.t);
            const dayOfMonth = date.getDate();
            const showMonth = i === 0 || dayOfMonth === 1;
            return (
              <g key={`label-${d.t}`}>
                <text
                  x={barX(i)}
                  y={CHART_HEIGHT - PAD_B + 12}
                  textAnchor="middle"
                  className="fill-gray-400"
                  fontSize="9"
                >
                  {dayOfMonth}
                </text>
                {showMonth && (
                  <text
                    x={barX(i)}
                    y={CHART_HEIGHT - PAD_B + 22}
                    textAnchor="middle"
                    className="fill-gray-500"
                    fontSize="9"
                  >
                    {date.toLocaleDateString(undefined, { month: `short` })}
                  </text>
                )}
              </g>
            );
          })}
          {forecastDays.map((d, i) => {
            const innerBarW = Math.max(2, barSlot * 0.7);
            const bx = barX(i) - innerBarW / 2;
            const by = toY(d.count);
            const bh = Math.max(0, toY(0) - by);
            return (
              <g key={d.t}>
                {d.count > 0 && (
                  <rect
                    x={bx}
                    y={by}
                    width={innerBarW}
                    height={bh}
                    fill="#16a34a"
                    opacity={hovered === i ? 0.8 : 1}
                    rx="2"
                  />
                )}
                <rect
                  x={barX(i) - barSlot / 2}
                  y={PAD_T}
                  width={barSlot}
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
            renderTooltip(barX(hovered), toY(forecastDays[hovered].count), [
              shortDate(forecastDays[hovered].t),
              forecastDays[hovered].count === 1
                ? t(`{{count}} card due`, { count: forecastDays[hovered].count })
                : t(`{{count}} cards due`, { count: forecastDays[hovered].count }),
            ])}
        </svg>
      )}
    </ChartCard>
  );
}
