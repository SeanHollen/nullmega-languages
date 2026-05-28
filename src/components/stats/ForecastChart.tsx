import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useLiveQuery } from "dexie-react-hooks";
import { DAY } from "../../utils/studySession";
import type { SrsCardWithStatus } from "./SrsStatsView";
import { forecastDueTimes } from "../../utils/srsForecast";
import { loadSrsSettings } from "../../utils/srsSettings";
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

type Scale = "48h" | "30d" | "1y";
type ForecastMode = "perBucket" | "cumulative";
const HOUR = 60 * 60 * 1000;
const WEEK = 7 * 24 * HOUR;

function hourStart(ts: number): number {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function weekStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday-aligned, matching streaks
  return d.getTime();
}

function labelFor(
  date: Date,
  i: number,
  scale: Scale,
  buckets: { t: number }[],
): { primary: string; secondary: string } {
  const dayOfMonth = date.getDate();
  const monthShort = date.toLocaleDateString(undefined, { month: `short` });
  if (scale === `48h`) {
    const hour = date.getHours();
    const showHour = hour % 6 === 0;
    const prevDate = i > 0 ? new Date(buckets[i - 1].t).getDate() : -1;
    const dayChanged = i === 0 || dayOfMonth !== prevDate;
    return {
      primary: showHour ? formatHour(hour) : ``,
      secondary: dayChanged ? `${dayOfMonth} ${monthShort}` : ``,
    };
  }
  if (scale === `30d`) {
    return {
      primary: String(dayOfMonth),
      secondary: i === 0 || dayOfMonth === 1 ? monthShort : ``,
    };
  }
  // 1y: month label at week-of-month-change; thin out primary numbers.
  const prevMonth = i > 0 ? new Date(buckets[i - 1].t).getMonth() : -1;
  const monthChanged = i === 0 || date.getMonth() !== prevMonth;
  const showEvery = Math.max(1, Math.floor(buckets.length / 12));
  return {
    primary: i % showEvery === 0 ? String(dayOfMonth) : ``,
    secondary: monthChanged ? monthShort : ``,
  };
}

function formatHour(hour: number): string {
  if (hour === 0) return `12a`;
  if (hour === 12) return `12p`;
  return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

function tooltipLabel(scale: Scale, ts: number, t: TFunction): string {
  if (scale === `48h`) {
    const d = new Date(ts);
    return `${d.toLocaleDateString(undefined, { weekday: `short` })} ${formatHour(d.getHours())}`;
  }
  if (scale === `1y`) return t(`Week of {{date}}`, { date: shortDate(ts) });
  return shortDate(ts);
}

interface Props {
  cards: SrsCardWithStatus[];
}

export function ForecastChart({ cards }: Props) {
  const { t } = useTranslation();
  const [now] = useState(() => Date.now());
  const [scale, setScale] = useState<Scale>(`30d`);
  const [mode, setMode] = useState<ForecastMode>(`perBucket`);
  const [hovered, setHovered] = useState<number | null>(null);
  const srsSettings = useLiveQuery(() => loadSrsSettings(), []);
  const useEase = srsSettings?.useEaseFromHistory ?? true;

  let fromMs: number;
  let bucketSizeMs: number;
  let bucketCount: number;
  let bucketAlign: (ts: number) => number;
  if (scale === `48h`) {
    fromMs = hourStart(now);
    bucketSizeMs = HOUR;
    bucketCount = 48;
    bucketAlign = hourStart;
  } else if (scale === `30d`) {
    fromMs = dayStart(now);
    bucketSizeMs = DAY;
    bucketCount = 30;
    bucketAlign = dayStart;
  } else {
    fromMs = weekStart(now);
    bucketSizeMs = WEEK;
    bucketCount = 53;
    bucketAlign = weekStart;
  }
  const horizonMs = fromMs + bucketCount * bucketSizeMs;

  const bucketCounts = new Map<number, number>();
  for (const card of cards) {
    const times = forecastDueTimes(card, fromMs, horizonMs, useEase, scale !== `48h`);
    for (const ts of times) {
      const key = bucketAlign(ts);
      bucketCounts.set(key, (bucketCounts.get(key) ?? 0) + 1);
    }
  }
  const forecastDays: { t: number; count: number; cumulative: number }[] = [];
  let running = 0;
  for (let i = 0; i < bucketCount; i++) {
    const bucketT = fromMs + i * bucketSizeMs;
    const count = bucketCounts.get(bucketT) ?? 0;
    running += count;
    forecastDays.push({ t: bucketT, count, cumulative: running });
  }
  const highValue =
    mode === `perBucket` ? Math.max(1, ...forecastDays.map((d) => d.count)) : Math.max(1, running);
  const high = Math.max(5, Math.ceil(highValue * 1.1));
  const ticks = [0, Math.round(high / 2), high];
  const barSlot = INNER_W / forecastDays.length;
  const totalDueInWindow = running;

  function barX(i: number): number {
    return PAD_L + i * barSlot + barSlot / 2;
  }
  function toY(count: number): number {
    return PAD_T + INNER_H - (count / high) * INNER_H;
  }

  let cumulativeLinePath = ``;
  let cumulativeAreaPath = ``;
  if (mode === `cumulative` && forecastDays.length > 0) {
    const parts: string[] = [];
    forecastDays.forEach((d, i) => {
      parts.push(`${i === 0 ? `M` : `L`}${barX(i)},${toY(d.cumulative)}`);
    });
    cumulativeLinePath = parts.join(` `);
    const baseY = toY(0);
    cumulativeAreaPath = `${cumulativeLinePath} L${barX(forecastDays.length - 1)},${baseY} L${barX(0)},${baseY} Z`;
  }

  let tooltipNode: React.ReactNode = null;
  if (hovered !== null && forecastDays[hovered]) {
    const d = forecastDays[hovered];
    const value = mode === `perBucket` ? d.count : d.cumulative;
    let valueLine: string;
    if (mode === `cumulative`) {
      valueLine = t(`{{count}} cumulative`, { count: d.cumulative });
    } else if (d.count === 1) {
      valueLine = t(`{{count}} card due`, { count: d.count });
    } else {
      valueLine = t(`{{count}} cards due`, { count: d.count });
    }
    tooltipNode = renderTooltip(barX(hovered), toY(value), [
      tooltipLabel(scale, d.t, t),
      valueLine,
    ]);
  }

  return (
    <ChartCard
      title={t(`Future review forecast`)}
      right={
        <ChartToggle
          value={scale}
          options={[
            [`48h`, t(`48h`)],
            [`30d`, t(`30d`)],
            [`1y`, t(`1y`)],
          ]}
          onChange={(next) => {
            setScale(next);
            setHovered(null);
          }}
        />
      }
      trailing={
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
          {t(`No reviews scheduled in this window.`)}
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
            const labels = labelFor(date, i, scale, forecastDays);
            return (
              <g key={`label-${d.t}`}>
                {labels.primary && (
                  <text
                    x={barX(i)}
                    y={CHART_HEIGHT - PAD_B + 12}
                    textAnchor="middle"
                    className="fill-gray-400"
                    fontSize="9"
                  >
                    {labels.primary}
                  </text>
                )}
                {labels.secondary && (
                  <text
                    x={barX(i)}
                    y={CHART_HEIGHT - PAD_B + 22}
                    textAnchor="middle"
                    className="fill-gray-500"
                    fontSize="9"
                  >
                    {labels.secondary}
                  </text>
                )}
              </g>
            );
          })}
          {mode === `perBucket` ? (
            forecastDays.map((d, i) => {
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
            })
          ) : (
            <g>
              <path d={cumulativeAreaPath} fill="#16a34a" opacity={0.2} />
              <path d={cumulativeLinePath} stroke="#16a34a" strokeWidth="2" fill="none" />
              {forecastDays.map((d, i) => (
                <g key={d.t}>
                  {hovered === i && (
                    <circle cx={barX(i)} cy={toY(d.cumulative)} r="3" fill="#16a34a" />
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
          )}
          {tooltipNode}
        </svg>
      )}
      {totalDueInWindow > 0 && (
        <div className="flex items-center justify-end gap-4 flex-wrap">
          <ChartToggle
            value={mode}
            options={[
              [`perBucket`, t(`Per day`)],
              [`cumulative`, t(`Cumulative`)],
            ]}
            onChange={(next) => {
              setMode(next);
              setHovered(null);
            }}
          />
        </div>
      )}
    </ChartCard>
  );
}
