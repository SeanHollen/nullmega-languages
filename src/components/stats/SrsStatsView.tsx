import { useState } from "react";
import { DAY } from "../../utils/studySession";
import type { SrsCard } from "../../utils/srsForecast";
import { forecastDueDays } from "../../utils/srsForecast";
import type { ReviewEntry } from "../../utils/flashcards";
import {
  aggregateOutcomesByDay,
  aggregateOutcomesByHour,
  aggregateOutcomesByInterval,
  formatIntervalLabel,
} from "../../utils/outcomesByInterval";

type OutcomeMode = "interval" | "day" | "hour";

export interface SrsCardWithStatus extends SrsCard {
  status: string;
  addedAt: number;
  // Optional because only Flashcards record review outcomes today; GrammarCards don't.
  reviewHistory?: ReviewEntry[];
}

type AddedMode = "perDay" | "cumulative";

const HORIZON_DAYS = 30;

const STATUSES = [`new`, `learning`, `relearning`, `due`, `scheduled`, `dropped`] as const;

const STATUS_COLOR: Record<string, string> = {
  new: `#9ca3af`,
  learning: `#f59e0b`,
  relearning: `#ef4444`,
  due: `#f97316`,
  scheduled: `#0ea5e9`,
  dropped: `#d1d5db`,
};

const WIDTH = 600;
const HEIGHT = 280;
const PAD_L = 36;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 36;

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function shortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: `short`, day: `numeric` });
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

interface Props {
  language: string;
  cards: SrsCardWithStatus[];
  emptyMessage: string;
}

export function SrsStatsView({ language, cards, emptyMessage }: Props) {
  const [now] = useState(() => Date.now());
  const [hoveredForecast, setHoveredForecast] = useState<number | null>(null);
  const [hoveredStatus, setHoveredStatus] = useState<number | null>(null);
  const [hoveredAdded, setHoveredAdded] = useState<number | null>(null);
  const [addedMode, setAddedMode] = useState<AddedMode>(`perDay`);
  const [outcomeMode, setOutcomeMode] = useState<OutcomeMode>(`interval`);
  const [hoveredOutcome, setHoveredOutcome] = useState<{
    bucket: number;
    side: "correct" | "incorrect";
  } | null>(null);

  const today = dayStart(now);
  const horizonMs = today + HORIZON_DAYS * DAY;

  const statusCounts = STATUSES.map((s) => ({
    status: s,
    count: cards.filter((c) => c.status === s).length,
  }));
  const visibleStatuses = statusCounts.filter((s) => s.count > 0);
  const maxStatusCount = Math.max(1, ...statusCounts.map((s) => s.count));

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
  const forecastHigh = Math.max(5, Math.ceil(maxDueCount * 1.1));

  const innerW = WIDTH - PAD_L - PAD_R;
  const innerH = HEIGHT - PAD_T - PAD_B;

  const forecastBarSlot = innerW / forecastDays.length;
  function forecastX(i: number): number {
    return PAD_L + i * forecastBarSlot + forecastBarSlot / 2;
  }
  function forecastY(count: number): number {
    return PAD_T + innerH - (count / forecastHigh) * innerH;
  }

  const statusBarSlot = visibleStatuses.length > 0 ? innerW / visibleStatuses.length : innerW;
  const statusBarW = Math.min(80, statusBarSlot * 0.6);
  function statusX(i: number): number {
    return PAD_L + i * statusBarSlot + statusBarSlot / 2;
  }
  function statusY(count: number): number {
    return PAD_T + innerH - (count / maxStatusCount) * innerH;
  }

  const forecastTicks = [0, Math.round(forecastHigh / 2), forecastHigh];
  const statusTicks = [0, Math.round(maxStatusCount / 2), maxStatusCount];

  const totalCards = cards.length;
  const totalDueInWindow = forecastDays.reduce((s, d) => s + d.count, 0);

  // ── Cards added over time ─────────────────────────────────────────────────
  // Build a daily series from the earliest addedAt to today. perDay = count per
  // day; cumulative = running total (burnup).
  const addedByDay = new Map<number, number>();
  for (const card of cards) {
    const d = dayStart(card.addedAt);
    addedByDay.set(d, (addedByDay.get(d) ?? 0) + 1);
  }
  const addedDayKeys = [...addedByDay.keys()];
  const earliestAdded = addedDayKeys.length > 0 ? Math.min(...addedDayKeys) : today;
  const addedSeries: { t: number; count: number; cumulative: number }[] = [];
  let runningCumulative = 0;
  for (let d = earliestAdded; d <= today; d += DAY) {
    const count = addedByDay.get(d) ?? 0;
    runningCumulative += count;
    addedSeries.push({ t: d, count, cumulative: runningCumulative });
  }
  const addedHighValue =
    addedMode === `perDay`
      ? Math.max(1, ...addedSeries.map((d) => d.count))
      : Math.max(1, runningCumulative);
  const addedHigh = Math.max(5, Math.ceil(addedHighValue * 1.1));
  const addedTicks = [0, Math.round(addedHigh / 2), addedHigh];
  const addedBarSlot = addedSeries.length > 0 ? innerW / addedSeries.length : innerW;
  function addedX(i: number): number {
    return PAD_L + i * addedBarSlot + addedBarSlot / 2;
  }
  function addedY(value: number): number {
    return PAD_T + innerH - (value / addedHigh) * innerH;
  }

  // ── Review outcomes (toggleable: by interval / by day / by hour) ─────────
  interface OutcomeBucket {
    label: string;
    tooltipLabel: string;
    correct: number;
    incorrect: number;
  }
  let outcomeBuckets: OutcomeBucket[];
  if (outcomeMode === `interval`) {
    outcomeBuckets = aggregateOutcomesByInterval(cards).map((b) => {
      const lbl = formatIntervalLabel(b.intervalMs);
      return {
        label: lbl,
        tooltipLabel: `${lbl} interval`,
        correct: b.correct,
        incorrect: b.incorrect,
      };
    });
  } else if (outcomeMode === `day`) {
    outcomeBuckets = aggregateOutcomesByDay(cards).map((b, i, arr) => {
      const date = new Date(b.dayStart);
      const dayOfMonth = date.getDate();
      const showMonth = i === 0 || dayOfMonth === 1 || i === arr.length - 1;
      const labelEveryNth = Math.max(1, Math.floor(arr.length / 30));
      const showThis = i % labelEveryNth === 0 || i === arr.length - 1;
      let label = ``;
      if (showThis) {
        label = showMonth
          ? `${dayOfMonth} ${date.toLocaleDateString(undefined, { month: `short` })}`
          : `${dayOfMonth}`;
      }
      return {
        label,
        tooltipLabel: shortDate(b.dayStart),
        correct: b.correct,
        incorrect: b.incorrect,
      };
    });
  } else {
    outcomeBuckets = aggregateOutcomesByHour(cards).map((b) => ({
      label: b.hour % 3 === 0 ? `${b.hour}` : ``,
      tooltipLabel: `${b.hour.toString().padStart(2, `0`)}:00`,
      correct: b.correct,
      incorrect: b.incorrect,
    }));
  }
  const totalOutcomes = outcomeBuckets.reduce((s, b) => s + b.correct + b.incorrect, 0);
  const maxOutcomeCount = Math.max(1, ...outcomeBuckets.flatMap((b) => [b.correct, b.incorrect]));
  const outcomeHigh = Math.max(5, Math.ceil(maxOutcomeCount * 1.1));
  const outcomeTicks = [0, Math.round(outcomeHigh / 2), outcomeHigh];
  const outcomeGroupSlot = outcomeBuckets.length > 0 ? innerW / outcomeBuckets.length : innerW;
  // When buckets are dense (day/hour modes can have many), narrow the bars.
  const outcomeBarW = Math.min(40, Math.max(2, outcomeGroupSlot * 0.35));
  function outcomeGroupX(i: number): number {
    return PAD_L + i * outcomeGroupSlot + outcomeGroupSlot / 2;
  }
  function outcomeY(count: number): number {
    return PAD_T + innerH - (count / outcomeHigh) * innerH;
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <p className="text-sm text-gray-500">{`Cards by status — ${language}`}</p>
          <div className="text-sm">
            <span className="text-gray-500">{`Total: `}</span>
            <span className="font-semibold text-gray-800">{totalCards}</span>
          </div>
        </div>

        {totalCards === 0 ? (
          <p className="text-sm text-gray-400 italic py-8 text-center">{emptyMessage}</p>
        ) : (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label="Cards by status"
          >
            {statusTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD_L}
                  x2={WIDTH - PAD_R}
                  y1={statusY(tick)}
                  y2={statusY(tick)}
                  stroke="#e5e7eb"
                  strokeDasharray="3 3"
                />
                <text
                  x={PAD_L - 6}
                  y={statusY(tick) + 4}
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

            {visibleStatuses.map((s, i) => {
              const bx = statusX(i) - statusBarW / 2;
              const by = statusY(s.count);
              const bh = Math.max(0, statusY(0) - by);
              return (
                <g key={s.status}>
                  <rect
                    x={bx}
                    y={by}
                    width={statusBarW}
                    height={bh}
                    fill={STATUS_COLOR[s.status] ?? `#9ca3af`}
                    opacity={hoveredStatus === i ? 0.8 : 1}
                    rx="2"
                  />
                  <text
                    x={statusX(i)}
                    y={HEIGHT - PAD_B + 16}
                    textAnchor="middle"
                    className="fill-gray-500"
                    fontSize="11"
                  >
                    {s.status}
                  </text>
                  <rect
                    x={statusX(i) - statusBarSlot / 2}
                    y={PAD_T}
                    width={statusBarSlot}
                    height={innerH}
                    fill="transparent"
                    style={{ cursor: `pointer` }}
                    onMouseEnter={() => setHoveredStatus(i)}
                    onMouseLeave={() => setHoveredStatus(null)}
                  />
                </g>
              );
            })}

            {hoveredStatus !== null &&
              renderTooltip(statusX(hoveredStatus), statusY(visibleStatuses[hoveredStatus].count), [
                `${visibleStatuses[hoveredStatus].status}`,
                `${visibleStatuses[hoveredStatus].count} card${visibleStatuses[hoveredStatus].count === 1 ? `` : `s`}`,
              ])}
          </svg>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 mt-6">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <p className="text-sm text-gray-500">{`Future review forecast (${HORIZON_DAYS} days)`}</p>
          {totalDueInWindow > 0 && (
            <div className="text-sm">
              <span className="text-gray-500">{`Reviews due: `}</span>
              <span className="font-semibold text-gray-800">{totalDueInWindow}</span>
            </div>
          )}
        </div>

        {totalDueInWindow === 0 ? (
          <p className="text-sm text-gray-400 italic py-8 text-center">
            {`No reviews scheduled in the next ${HORIZON_DAYS} days.`}
          </p>
        ) : (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label="Future review forecast"
          >
            {forecastTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD_L}
                  x2={WIDTH - PAD_R}
                  y1={forecastY(tick)}
                  y2={forecastY(tick)}
                  stroke="#e5e7eb"
                  strokeDasharray="3 3"
                />
                <text
                  x={PAD_L - 6}
                  y={forecastY(tick) + 4}
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

            {forecastDays.map((d, i) => {
              const date = new Date(d.t);
              const dayOfMonth = date.getDate();
              const showMonth = i === 0 || dayOfMonth === 1;
              return (
                <g key={`label-${d.t}`}>
                  <text
                    x={forecastX(i)}
                    y={HEIGHT - PAD_B + 12}
                    textAnchor="middle"
                    className="fill-gray-400"
                    fontSize="9"
                  >
                    {dayOfMonth}
                  </text>
                  {showMonth && (
                    <text
                      x={forecastX(i)}
                      y={HEIGHT - PAD_B + 22}
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
              const innerBarW = Math.max(2, forecastBarSlot * 0.7);
              const bx = forecastX(i) - innerBarW / 2;
              const by = forecastY(d.count);
              const bh = Math.max(0, forecastY(0) - by);
              return (
                <g key={d.t}>
                  {d.count > 0 && (
                    <rect
                      x={bx}
                      y={by}
                      width={innerBarW}
                      height={bh}
                      fill="#16a34a"
                      opacity={hoveredForecast === i ? 0.8 : 1}
                      rx="2"
                    />
                  )}
                  <rect
                    x={forecastX(i) - forecastBarSlot / 2}
                    y={PAD_T}
                    width={forecastBarSlot}
                    height={innerH}
                    fill="transparent"
                    style={{ cursor: `pointer` }}
                    onMouseEnter={() => setHoveredForecast(i)}
                    onMouseLeave={() => setHoveredForecast(null)}
                  />
                </g>
              );
            })}

            {hoveredForecast !== null &&
              renderTooltip(
                forecastX(hoveredForecast),
                forecastY(forecastDays[hoveredForecast].count),
                [
                  `${shortDate(forecastDays[hoveredForecast].t)}`,
                  `${forecastDays[hoveredForecast].count} card${forecastDays[hoveredForecast].count === 1 ? `` : `s`} due`,
                ],
              )}
          </svg>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 mt-6">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <p className="text-sm text-gray-500">{`Cards added over time`}</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddedMode(`perDay`)}
              className={`text-xs px-3 py-1 rounded-md transition cursor-pointer ${
                addedMode === `perDay`
                  ? `bg-green-100 text-green-700 font-medium`
                  : `text-gray-500 hover:bg-gray-100`
              }`}
            >
              {`Per day`}
            </button>
            <button
              onClick={() => setAddedMode(`cumulative`)}
              className={`text-xs px-3 py-1 rounded-md transition cursor-pointer ${
                addedMode === `cumulative`
                  ? `bg-green-100 text-green-700 font-medium`
                  : `text-gray-500 hover:bg-gray-100`
              }`}
            >
              {`Cumulative`}
            </button>
          </div>
        </div>

        {totalCards === 0 ? (
          <p className="text-sm text-gray-400 italic py-8 text-center">{emptyMessage}</p>
        ) : (
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label="Cards added over time"
          >
            {addedTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD_L}
                  x2={WIDTH - PAD_R}
                  y1={addedY(tick)}
                  y2={addedY(tick)}
                  stroke="#e5e7eb"
                  strokeDasharray="3 3"
                />
                <text
                  x={PAD_L - 6}
                  y={addedY(tick) + 4}
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

            {addedSeries.map((d, i) => {
              const date = new Date(d.t);
              const dayOfMonth = date.getDate();
              const showMonth = i === 0 || dayOfMonth === 1;
              const labelEveryNth = Math.max(1, Math.floor(addedSeries.length / 30));
              if (i % labelEveryNth !== 0 && i !== addedSeries.length - 1) return null;
              return (
                <g key={`label-${d.t}`}>
                  <text
                    x={addedX(i)}
                    y={HEIGHT - PAD_B + 12}
                    textAnchor="middle"
                    className="fill-gray-400"
                    fontSize="9"
                  >
                    {dayOfMonth}
                  </text>
                  {showMonth && (
                    <text
                      x={addedX(i)}
                      y={HEIGHT - PAD_B + 22}
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

            {addedMode === `perDay`
              ? addedSeries.map((d, i) => {
                  const innerBarW = Math.max(2, addedBarSlot * 0.7);
                  const bx = addedX(i) - innerBarW / 2;
                  const by = addedY(d.count);
                  const bh = Math.max(0, addedY(0) - by);
                  return (
                    <g key={d.t}>
                      {d.count > 0 && (
                        <rect
                          x={bx}
                          y={by}
                          width={innerBarW}
                          height={bh}
                          fill="#0ea5e9"
                          opacity={hoveredAdded === i ? 0.8 : 1}
                          rx="2"
                        />
                      )}
                      <rect
                        x={addedX(i) - addedBarSlot / 2}
                        y={PAD_T}
                        width={addedBarSlot}
                        height={innerH}
                        fill="transparent"
                        style={{ cursor: `pointer` }}
                        onMouseEnter={() => setHoveredAdded(i)}
                        onMouseLeave={() => setHoveredAdded(null)}
                      />
                    </g>
                  );
                })
              : (() => {
                  // Step-area path for cumulative.
                  const path: string[] = [];
                  addedSeries.forEach((d, i) => {
                    const x = addedX(i);
                    const y = addedY(d.cumulative);
                    path.push(`${i === 0 ? `M` : `L`}${x},${y}`);
                  });
                  const baseY = addedY(0);
                  const lastX = addedX(addedSeries.length - 1);
                  const firstX = addedX(0);
                  const areaPath = `${path.join(` `)} L${lastX},${baseY} L${firstX},${baseY} Z`;
                  return (
                    <g>
                      <path d={areaPath} fill="#0ea5e9" opacity={0.2} />
                      <path d={path.join(` `)} stroke="#0ea5e9" strokeWidth="2" fill="none" />
                      {addedSeries.map((d, i) => (
                        <g key={d.t}>
                          {hoveredAdded === i && (
                            <circle cx={addedX(i)} cy={addedY(d.cumulative)} r="3" fill="#0ea5e9" />
                          )}
                          <rect
                            x={addedX(i) - addedBarSlot / 2}
                            y={PAD_T}
                            width={addedBarSlot}
                            height={innerH}
                            fill="transparent"
                            style={{ cursor: `pointer` }}
                            onMouseEnter={() => setHoveredAdded(i)}
                            onMouseLeave={() => setHoveredAdded(null)}
                          />
                        </g>
                      ))}
                    </g>
                  );
                })()}

            {hoveredAdded !== null &&
              (() => {
                const d = addedSeries[hoveredAdded];
                const value = addedMode === `perDay` ? d.count : d.cumulative;
                const valueLine =
                  addedMode === `perDay` ? `${d.count} added` : `${d.cumulative} total`;
                return renderTooltip(addedX(hoveredAdded), addedY(value), [
                  shortDate(d.t),
                  valueLine,
                ]);
              })()}
          </svg>
        )}
      </div>

      {(totalOutcomes > 0 || outcomeMode !== `interval`) && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4 mt-6">
          <div className="flex items-baseline justify-between gap-4 flex-wrap">
            <p className="text-sm text-gray-500">{`Review outcomes`}</p>
            <div className="flex items-center gap-2">
              {(
                [
                  [`interval`, `Per interval`],
                  [`day`, `Per day`],
                  [`hour`, `Per hour`],
                ] as [OutcomeMode, string][]
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => {
                    setOutcomeMode(mode);
                    setHoveredOutcome(null);
                  }}
                  className={`text-xs px-3 py-1 rounded-md transition cursor-pointer ${
                    outcomeMode === mode
                      ? `bg-green-100 text-green-700 font-medium`
                      : `text-gray-500 hover:bg-gray-100`
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="text-sm text-right">
            <span className="text-gray-500">{`Reviews logged: `}</span>
            <span className="font-semibold text-gray-800">{totalOutcomes}</span>
          </div>

          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            role="img"
            aria-label="Review outcomes by interval"
          >
            {outcomeTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD_L}
                  x2={WIDTH - PAD_R}
                  y1={outcomeY(tick)}
                  y2={outcomeY(tick)}
                  stroke="#e5e7eb"
                  strokeDasharray="3 3"
                />
                <text
                  x={PAD_L - 6}
                  y={outcomeY(tick) + 4}
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

            {outcomeBuckets.map((b, i) => {
              const cx = outcomeGroupX(i);
              const correctX = cx - outcomeBarW - 1;
              const incorrectX = cx + 1;
              const correctY = outcomeY(b.correct);
              const incorrectY = outcomeY(b.incorrect);
              const baseY = outcomeY(0);
              const isHoveredCorrect =
                hoveredOutcome?.bucket === i && hoveredOutcome.side === `correct`;
              const isHoveredIncorrect =
                hoveredOutcome?.bucket === i && hoveredOutcome.side === `incorrect`;
              return (
                <g key={i}>
                  {b.correct > 0 && (
                    <rect
                      x={correctX}
                      y={correctY}
                      width={outcomeBarW}
                      height={Math.max(0, baseY - correctY)}
                      fill="#16a34a"
                      opacity={isHoveredCorrect ? 0.8 : 1}
                      rx="2"
                    />
                  )}
                  {b.incorrect > 0 && (
                    <rect
                      x={incorrectX}
                      y={incorrectY}
                      width={outcomeBarW}
                      height={Math.max(0, baseY - incorrectY)}
                      fill="#ef4444"
                      opacity={isHoveredIncorrect ? 0.8 : 1}
                      rx="2"
                    />
                  )}
                  {b.label && (
                    <text
                      x={cx}
                      y={HEIGHT - PAD_B + 14}
                      textAnchor="middle"
                      className="fill-gray-500"
                      fontSize="10"
                    >
                      {b.label}
                    </text>
                  )}
                  <rect
                    x={cx - outcomeGroupSlot / 2}
                    y={PAD_T}
                    width={outcomeGroupSlot / 2}
                    height={innerH}
                    fill="transparent"
                    style={{ cursor: `pointer` }}
                    onMouseEnter={() => setHoveredOutcome({ bucket: i, side: `correct` })}
                    onMouseLeave={() => setHoveredOutcome(null)}
                  />
                  <rect
                    x={cx}
                    y={PAD_T}
                    width={outcomeGroupSlot / 2}
                    height={innerH}
                    fill="transparent"
                    style={{ cursor: `pointer` }}
                    onMouseEnter={() => setHoveredOutcome({ bucket: i, side: `incorrect` })}
                    onMouseLeave={() => setHoveredOutcome(null)}
                  />
                </g>
              );
            })}

            {hoveredOutcome !== null &&
              (() => {
                const b = outcomeBuckets[hoveredOutcome.bucket];
                const count = hoveredOutcome.side === `correct` ? b.correct : b.incorrect;
                const cx = outcomeGroupX(hoveredOutcome.bucket);
                const tx =
                  hoveredOutcome.side === `correct`
                    ? cx - outcomeBarW / 2 - 1
                    : cx + outcomeBarW / 2 + 1;
                return renderTooltip(tx, outcomeY(count), [
                  b.tooltipLabel,
                  `${count} ${hoveredOutcome.side}`,
                ]);
              })()}
          </svg>

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-600" />
              {`Correct`}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-red-500" />
              {`Incorrect`}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
