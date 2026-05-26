import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DAY } from "../../utils/studySession";
import type { SrsCardWithStatus } from "./SrsStatsView";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  ChartCard,
  ChartFrame,
  ChartToggle,
  INNER_H,
  INNER_W,
  PAD_B,
  PAD_L,
  PAD_T,
  dayStart,
  renderTooltip,
  shortDate,
} from "./chartCommon";

type AddedMode = "perDay" | "cumulative";

interface Props {
  cards: SrsCardWithStatus[];
  emptyMessage: string;
}

export function CardsAddedChart({ cards, emptyMessage }: Props) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());
  const [mode, setMode] = useState<AddedMode>(`perDay`);
  const [hovered, setHovered] = useState<number | null>(null);

  const today = dayStart(now);
  const addedByDay = new Map<number, number>();
  for (const card of cards) {
    const d = dayStart(card.addedAt);
    addedByDay.set(d, (addedByDay.get(d) ?? 0) + 1);
  }
  const addedDayKeys = [...addedByDay.keys()];
  const earliestAdded = addedDayKeys.length > 0 ? Math.min(...addedDayKeys) : today;
  const series: { t: number; count: number; cumulative: number }[] = [];
  let running = 0;
  for (let d = earliestAdded; d <= today; d += DAY) {
    const count = addedByDay.get(d) ?? 0;
    running += count;
    series.push({ t: d, count, cumulative: running });
  }
  const highValue =
    mode === `perDay` ? Math.max(1, ...series.map((d) => d.count)) : Math.max(1, running);
  const high = Math.max(5, Math.ceil(highValue * 1.1));
  const ticks = [0, Math.round(high / 2), high];
  const barSlot = series.length > 0 ? INNER_W / series.length : INNER_W;

  function barX(i: number): number {
    return PAD_L + i * barSlot + barSlot / 2;
  }
  function toY(value: number): number {
    return PAD_T + INNER_H - (value / high) * INNER_H;
  }

  const totalCards = cards.length;

  return (
    <ChartCard
      title={t(`Cards added over time`)}
      right={
        <ChartToggle
          value={mode}
          options={[
            [`perDay`, t(`Per day`)],
            [`cumulative`, t(`Cumulative`)],
          ]}
          onChange={setMode}
        />
      }
    >
      {totalCards === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">{emptyMessage}</p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={t(`Cards added over time`)}
        >
          <ChartFrame ticks={ticks} toY={toY} />
          {series.map((d, i) => {
            const date = new Date(d.t);
            const dayOfMonth = date.getDate();
            const showMonth = i === 0 || dayOfMonth === 1;
            const labelEveryNth = Math.max(1, Math.floor(series.length / 30));
            if (i % labelEveryNth !== 0 && i !== series.length - 1) return null;
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

          {mode === `perDay`
            ? series.map((d, i) => {
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
                        fill="#0ea5e9"
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
              })
            : (() => {
                // Step-area path for cumulative.
                const path: string[] = [];
                series.forEach((d, i) => {
                  path.push(`${i === 0 ? `M` : `L`}${barX(i)},${toY(d.cumulative)}`);
                });
                const baseY = toY(0);
                const lastX = barX(series.length - 1);
                const firstX = barX(0);
                const areaPath = `${path.join(` `)} L${lastX},${baseY} L${firstX},${baseY} Z`;
                return (
                  <g>
                    <path d={areaPath} fill="#0ea5e9" opacity={0.2} />
                    <path d={path.join(` `)} stroke="#0ea5e9" strokeWidth="2" fill="none" />
                    {series.map((d, i) => (
                      <g key={d.t}>
                        {hovered === i && (
                          <circle cx={barX(i)} cy={toY(d.cumulative)} r="3" fill="#0ea5e9" />
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
                    ))}
                  </g>
                );
              })()}

          {hovered !== null &&
            (() => {
              const d = series[hovered];
              const value = mode === `perDay` ? d.count : d.cumulative;
              const valueLine =
                mode === `perDay`
                  ? t(`{{count}} added`, { count: d.count })
                  : t(`{{count}} total`, { count: d.cumulative });
              return renderTooltip(barX(hovered), toY(value), [shortDate(d.t), valueLine]);
            })()}
        </svg>
      )}
    </ChartCard>
  );
}
