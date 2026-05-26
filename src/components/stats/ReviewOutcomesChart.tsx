import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { SrsCardWithStatus } from "./SrsStatsView";
import {
  aggregateOutcomesByDay,
  aggregateOutcomesByHour,
  aggregateOutcomesByInterval,
  formatIntervalLabel,
} from "../../utils/outcomesByInterval";
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
  renderTooltip,
  shortDate,
} from "./chartCommon";

type OutcomeMode = "interval" | "day" | "hour";
type OutcomeScale = "totals" | "percent";

interface OutcomeBucket {
  label: string;
  tooltipLabel: string;
  correct: number;
  incorrect: number;
}

function buildBuckets(
  cards: SrsCardWithStatus[],
  mode: OutcomeMode,
  t: TFunction,
): OutcomeBucket[] {
  if (mode === `interval`) {
    return aggregateOutcomesByInterval(cards).map((b) => {
      const lbl = formatIntervalLabel(b.intervalMs);
      return {
        label: lbl,
        tooltipLabel: t(`{{interval}} interval`, { interval: lbl }),
        correct: b.correct,
        incorrect: b.incorrect,
      };
    });
  }
  if (mode === `day`) {
    return aggregateOutcomesByDay(cards).map((b, i, arr) => {
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
  }
  return aggregateOutcomesByHour(cards).map((b) => ({
    label: b.hour % 3 === 0 ? formatHourLabel(b.hour) : ``,
    tooltipLabel: formatHourLabel(b.hour),
    correct: b.correct,
    incorrect: b.incorrect,
  }));
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return `12am`;
  if (hour === 12) return `12pm`;
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

interface Props {
  cards: SrsCardWithStatus[];
}

export function ReviewOutcomesChart({ cards }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<OutcomeMode>(`interval`);
  const [scale, setScale] = useState<OutcomeScale>(`totals`);
  const [hovered, setHovered] = useState<{ bucket: number; side: "correct" | "incorrect" } | null>(
    null,
  );

  const buckets = buildBuckets(cards, mode, t);
  const totalOutcomes = buckets.reduce((s, b) => s + b.correct + b.incorrect, 0);
  if (totalOutcomes === 0 && mode === `interval`) return null;

  // In percent mode, each bucket's bars are a share of that bucket's total. Zero-review
  // buckets render as zero-height bars without NaN.
  const values = buckets.map((b) => {
    if (scale === `totals`) return { correctVal: b.correct, incorrectVal: b.incorrect };
    const total = b.correct + b.incorrect;
    return {
      correctVal: total > 0 ? (b.correct / total) * 100 : 0,
      incorrectVal: total > 0 ? (b.incorrect / total) * 100 : 0,
    };
  });
  const maxCount =
    scale === `percent`
      ? 100
      : Math.max(1, ...values.flatMap((v) => [v.correctVal, v.incorrectVal]));
  const high = scale === `percent` ? 100 : Math.max(5, Math.ceil(maxCount * 1.1));
  const ticks = scale === `percent` ? [0, 50, 100] : [0, Math.round(high / 2), high];
  const groupSlot = buckets.length > 0 ? INNER_W / buckets.length : INNER_W;
  // Narrow bars when buckets are dense (day/hour modes).
  const barW = Math.min(40, Math.max(2, groupSlot * 0.35));

  function groupX(i: number): number {
    return PAD_L + i * groupSlot + groupSlot / 2;
  }
  function toY(value: number): number {
    return PAD_T + INNER_H - (value / high) * INNER_H;
  }
  function formatValue(value: number): string {
    return scale === `percent` ? `${value.toFixed(0)}%` : `${value}`;
  }
  function formatTick(tick: number): string {
    return scale === `percent` ? `${tick}%` : `${tick}`;
  }

  return (
    <ChartCard
      title={t(`Review outcomes`)}
      right={
        <ChartToggle
          value={mode}
          options={[
            [`interval`, t(`Per interval`)],
            [`day`, t(`Per day`)],
            [`hour`, t(`Per time of day`)],
          ]}
          onChange={(next) => {
            setMode(next);
            setHovered(null);
          }}
        />
      }
      trailing={
        <div className="text-sm text-right">
          <span className="text-gray-500">{t(`Reviews logged:`)} </span>
          <span className="font-semibold text-gray-800">{totalOutcomes}</span>
        </div>
      }
    >
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={t(`Review outcomes`)}
      >
        <ChartFrame ticks={ticks} toY={toY} formatTick={formatTick} />
        {buckets.map((b, i) => {
          const v = values[i];
          const cx = groupX(i);
          const baseY = toY(0);
          const isHoveredCorrect = hovered?.bucket === i && hovered.side === `correct`;
          const isHoveredIncorrect = hovered?.bucket === i && hovered.side === `incorrect`;
          const stacked = scale === `percent`;
          // Stacked mode: one centered bar with correct on bottom + incorrect stacked above.
          // Totals mode: two bars side-by-side around the bucket center.
          const stackedW = Math.min(48, Math.max(2, groupSlot * 0.6));
          const stackedX = cx - stackedW / 2;
          const correctTopY = toY(v.correctVal);
          const incorrectTopY = toY(v.correctVal + v.incorrectVal);
          return (
            <g key={i}>
              {stacked ? (
                <>
                  {v.correctVal > 0 && (
                    <rect
                      x={stackedX}
                      y={correctTopY}
                      width={stackedW}
                      height={Math.max(0, baseY - correctTopY)}
                      fill="#16a34a"
                      opacity={isHoveredCorrect ? 0.8 : 1}
                    />
                  )}
                  {v.incorrectVal > 0 && (
                    <rect
                      x={stackedX}
                      y={incorrectTopY}
                      width={stackedW}
                      height={Math.max(0, correctTopY - incorrectTopY)}
                      fill="#ef4444"
                      opacity={isHoveredIncorrect ? 0.8 : 1}
                    />
                  )}
                </>
              ) : (
                <>
                  {v.correctVal > 0 && (
                    <rect
                      x={cx - barW - 1}
                      y={correctTopY}
                      width={barW}
                      height={Math.max(0, baseY - correctTopY)}
                      fill="#16a34a"
                      opacity={isHoveredCorrect ? 0.8 : 1}
                      rx="2"
                    />
                  )}
                  {v.incorrectVal > 0 && (
                    <rect
                      x={cx + 1}
                      y={toY(v.incorrectVal)}
                      width={barW}
                      height={Math.max(0, baseY - toY(v.incorrectVal))}
                      fill="#ef4444"
                      opacity={isHoveredIncorrect ? 0.8 : 1}
                      rx="2"
                    />
                  )}
                </>
              )}
              {mode === `hour` && (
                <line
                  x1={cx}
                  x2={cx}
                  y1={CHART_HEIGHT - PAD_B}
                  y2={CHART_HEIGHT - PAD_B + 3}
                  stroke="#9ca3af"
                />
              )}
              {b.label && (
                <text
                  x={cx}
                  y={CHART_HEIGHT - PAD_B + 14}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize="10"
                >
                  {b.label}
                </text>
              )}
              {stacked ? (
                <>
                  <rect
                    x={stackedX}
                    y={correctTopY}
                    width={stackedW}
                    height={Math.max(0, baseY - correctTopY)}
                    fill="transparent"
                    style={{ cursor: `pointer` }}
                    onMouseEnter={() => setHovered({ bucket: i, side: `correct` })}
                    onMouseLeave={() => setHovered(null)}
                  />
                  <rect
                    x={stackedX}
                    y={incorrectTopY}
                    width={stackedW}
                    height={Math.max(0, correctTopY - incorrectTopY)}
                    fill="transparent"
                    style={{ cursor: `pointer` }}
                    onMouseEnter={() => setHovered({ bucket: i, side: `incorrect` })}
                    onMouseLeave={() => setHovered(null)}
                  />
                </>
              ) : (
                <>
                  <rect
                    x={cx - groupSlot / 2}
                    y={PAD_T}
                    width={groupSlot / 2}
                    height={INNER_H}
                    fill="transparent"
                    style={{ cursor: `pointer` }}
                    onMouseEnter={() => setHovered({ bucket: i, side: `correct` })}
                    onMouseLeave={() => setHovered(null)}
                  />
                  <rect
                    x={cx}
                    y={PAD_T}
                    width={groupSlot / 2}
                    height={INNER_H}
                    fill="transparent"
                    style={{ cursor: `pointer` }}
                    onMouseEnter={() => setHovered({ bucket: i, side: `incorrect` })}
                    onMouseLeave={() => setHovered(null)}
                  />
                </>
              )}
            </g>
          );
        })}
        {hovered !== null &&
          (() => {
            const b = buckets[hovered.bucket];
            const v = values[hovered.bucket];
            const value = hovered.side === `correct` ? v.correctVal : v.incorrectVal;
            const cx = groupX(hovered.bucket);
            const stacked = scale === `percent`;
            let tx: number;
            let ty: number;
            if (stacked) {
              tx = cx;
              ty =
                hovered.side === `correct` ? toY(v.correctVal) : toY(v.correctVal + v.incorrectVal);
            } else {
              tx = hovered.side === `correct` ? cx - barW / 2 - 1 : cx + barW / 2 + 1;
              ty = toY(value);
            }
            return renderTooltip(tx, ty, [
              b.tooltipLabel,
              hovered.side === `correct`
                ? t(`{{value}} correct`, { value: formatValue(value) })
                : t(`{{value}} incorrect`, { value: formatValue(value) }),
            ]);
          })()}
      </svg>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-600" />
            {t(`Correct`)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500" />
            {t(`Incorrect`)}
          </span>
        </div>
        <ChartToggle
          value={scale}
          options={[
            [`totals`, t(`Totals`)],
            [`percent`, t(`Percent`)],
          ]}
          onChange={(next) => {
            setScale(next);
            setHovered(null);
          }}
        />
      </div>
    </ChartCard>
  );
}
