import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AssessmentRecord } from "../../utils/history";
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
} from "./chartCommon";

type WindowSize = "20" | "50" | "100";
type Scale = "totals" | "percent";
type Outcome = "pass" | "tie" | "loss";

interface DifficultyBucket {
  label: string;
  rangeLabel: string;
  pass: number;
  tie: number;
  loss: number;
}

const TARGET_BUCKETS = 10;

function classify(r: AssessmentRecord): Outcome | null {
  if (r.ratingBefore === null || r.ratingAfter === null) return null;
  const delta = r.ratingAfter - r.ratingBefore;
  if (delta > 0) return `pass`;
  if (delta < 0) return `loss`;
  return `tie`;
}

function buildBuckets(records: AssessmentRecord[]): DifficultyBucket[] {
  const rated = records.filter((r) => classify(r) !== null);
  if (rated.length === 0) return [];
  const difficulties = rated.map((r) => Math.max(1, Math.min(100, Math.round(r.difficulty))));
  const dataMin = Math.min(...difficulties);
  const dataMax = Math.max(...difficulties);
  const span = dataMax - dataMin + 1;
  const bucketWidth = Math.max(1, Math.ceil(span / TARGET_BUCKETS));
  const lo = Math.max(1, Math.floor((dataMin - 1) / bucketWidth) * bucketWidth + 1);
  const bucketCount = Math.max(1, Math.ceil((dataMax - lo + 1) / bucketWidth));
  const buckets: DifficultyBucket[] = Array.from({ length: bucketCount }, (_, i) => {
    const start = lo + i * bucketWidth;
    const end = Math.min(100, start + bucketWidth - 1);
    const label = start === end ? `${start}` : `${start}–${end}`;
    return { label, rangeLabel: label, pass: 0, tie: 0, loss: 0 };
  });
  for (const r of rated) {
    const d = Math.max(1, Math.min(100, Math.round(r.difficulty)));
    const idx = Math.min(bucketCount - 1, Math.floor((d - lo) / bucketWidth));
    const outcome = classify(r);
    if (outcome) buckets[idx][outcome]++;
  }
  return buckets;
}

interface Props {
  history: AssessmentRecord[];
}

export function OutcomesByDifficultyChart({ history }: Props) {
  const { t } = useTranslation();
  const [windowSize, setWindowSize] = useState<WindowSize>(`50`);
  const [scale, setScale] = useState<Scale>(`totals`);
  const [hovered, setHovered] = useState<{ bucket: number; outcome: Outcome } | null>(null);

  const completed = history
    .filter(
      (r): r is AssessmentRecord & { completedAt: number } => typeof r.completedAt === `number`,
    )
    .sort((a, b) => b.completedAt - a.completedAt)
    .slice(0, Number(windowSize));

  const buckets = buildBuckets(completed);
  const totalOutcomes = buckets.reduce((s, b) => s + b.pass + b.tie + b.loss, 0);

  const values = buckets.map((b) => {
    if (scale === `totals`) return { pass: b.pass, tie: b.tie, loss: b.loss };
    const total = b.pass + b.tie + b.loss;
    if (total === 0) return { pass: 0, tie: 0, loss: 0 };
    return {
      pass: (b.pass / total) * 100,
      tie: (b.tie / total) * 100,
      loss: (b.loss / total) * 100,
    };
  });

  const maxValue =
    scale === `percent` ? 100 : Math.max(1, ...values.flatMap((v) => [v.pass, v.tie, v.loss]));
  const high = scale === `percent` ? 100 : Math.max(5, Math.ceil(maxValue * 1.1));
  const ticks = scale === `percent` ? [0, 50, 100] : [0, Math.round(high / 2), high];

  const groupSlot = INNER_W / buckets.length;
  const barW = Math.min(14, Math.max(2, groupSlot * 0.22));

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

  const COLOR: Record<Outcome, string> = {
    pass: `#16a34a`,
    tie: `#9ca3af`,
    loss: `#ef4444`,
  };
  const OUTCOME_LABEL: Record<Outcome, string> = {
    pass: t(`Pass`),
    tie: t(`Tie`),
    loss: t(`Loss`),
  };

  let tooltipNode: React.ReactNode = null;
  if (hovered !== null && buckets[hovered.bucket]) {
    const b = buckets[hovered.bucket];
    const v = values[hovered.bucket];
    const value = v[hovered.outcome];
    const cx = groupX(hovered.bucket);
    const stacked = scale === `percent`;
    let tx: number;
    let ty: number;
    if (stacked) {
      if (hovered.outcome === `pass`) ty = toY(v.pass);
      else if (hovered.outcome === `tie`) ty = toY(v.pass + v.tie);
      else ty = toY(v.pass + v.tie + v.loss);
      tx = cx;
    } else {
      let offset: number;
      if (hovered.outcome === `pass`) offset = -barW - 1;
      else if (hovered.outcome === `tie`) offset = 0;
      else offset = barW + 1;
      tx = cx + offset;
      ty = toY(value);
    }
    tooltipNode = renderTooltip(tx, ty, [
      t(`Difficulty {{range}}`, { range: b.rangeLabel }),
      `${OUTCOME_LABEL[hovered.outcome]}: ${formatValue(value)}`,
      t(`{{count}} total`, { count: b.pass + b.tie + b.loss }),
    ]);
  }

  return (
    <ChartCard
      title={t(`Outcomes by difficulty`)}
      right={
        <ChartToggle
          value={windowSize}
          options={[
            [`20`, t(`Last 20`)],
            [`50`, t(`Last 50`)],
            [`100`, t(`Last 100`)],
          ]}
          onChange={(next) => {
            setWindowSize(next);
            setHovered(null);
          }}
        />
      }
      trailing={
        <div className="text-sm text-right">
          <span className="text-gray-500">{t(`Rated exercises:`)} </span>
          <span className="font-semibold text-gray-800">{totalOutcomes}</span>
        </div>
      }
    >
      {totalOutcomes === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">
          {t(`No rated exercises yet.`)}
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={t(`Outcomes by difficulty`)}
        >
          <ChartFrame ticks={ticks} toY={toY} formatTick={formatTick} />
          {buckets.map((b, i) => {
            const v = values[i];
            const cx = groupX(i);
            const baseY = toY(0);
            const stacked = scale === `percent`;
            const passTopY = toY(v.pass);
            const tieTopY = toY(v.pass + v.tie);
            const lossTopY = toY(v.pass + v.tie + v.loss);
            const stackedW = Math.min(40, Math.max(2, groupSlot * 0.55));
            const stackedX = cx - stackedW / 2;
            return (
              <g key={i}>
                {stacked ? (
                  <>
                    {v.pass > 0 && (
                      <rect
                        x={stackedX}
                        y={passTopY}
                        width={stackedW}
                        height={Math.max(0, baseY - passTopY)}
                        fill={COLOR.pass}
                        opacity={hovered?.bucket === i && hovered.outcome === `pass` ? 0.8 : 1}
                      />
                    )}
                    {v.tie > 0 && (
                      <rect
                        x={stackedX}
                        y={tieTopY}
                        width={stackedW}
                        height={Math.max(0, passTopY - tieTopY)}
                        fill={COLOR.tie}
                        opacity={hovered?.bucket === i && hovered.outcome === `tie` ? 0.8 : 1}
                      />
                    )}
                    {v.loss > 0 && (
                      <rect
                        x={stackedX}
                        y={lossTopY}
                        width={stackedW}
                        height={Math.max(0, tieTopY - lossTopY)}
                        fill={COLOR.loss}
                        opacity={hovered?.bucket === i && hovered.outcome === `loss` ? 0.8 : 1}
                      />
                    )}
                  </>
                ) : (
                  <>
                    {v.pass > 0 && (
                      <rect
                        x={cx - barW * 1.5 - 1}
                        y={passTopY}
                        width={barW}
                        height={Math.max(0, baseY - passTopY)}
                        fill={COLOR.pass}
                        opacity={hovered?.bucket === i && hovered.outcome === `pass` ? 0.8 : 1}
                        rx="2"
                      />
                    )}
                    {v.tie > 0 && (
                      <rect
                        x={cx - barW / 2}
                        y={toY(v.tie)}
                        width={barW}
                        height={Math.max(0, baseY - toY(v.tie))}
                        fill={COLOR.tie}
                        opacity={hovered?.bucket === i && hovered.outcome === `tie` ? 0.8 : 1}
                        rx="2"
                      />
                    )}
                    {v.loss > 0 && (
                      <rect
                        x={cx + barW / 2 + 1}
                        y={toY(v.loss)}
                        width={barW}
                        height={Math.max(0, baseY - toY(v.loss))}
                        fill={COLOR.loss}
                        opacity={hovered?.bucket === i && hovered.outcome === `loss` ? 0.8 : 1}
                        rx="2"
                      />
                    )}
                  </>
                )}
                <text
                  x={cx}
                  y={CHART_HEIGHT - PAD_B + 14}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize="10"
                >
                  {b.label}
                </text>
                {stacked ? (
                  <>
                    <rect
                      x={stackedX}
                      y={passTopY}
                      width={stackedW}
                      height={Math.max(0, baseY - passTopY)}
                      fill="transparent"
                      style={{ cursor: `pointer` }}
                      onMouseEnter={() => setHovered({ bucket: i, outcome: `pass` })}
                      onMouseLeave={() => setHovered(null)}
                    />
                    <rect
                      x={stackedX}
                      y={tieTopY}
                      width={stackedW}
                      height={Math.max(0, passTopY - tieTopY)}
                      fill="transparent"
                      style={{ cursor: `pointer` }}
                      onMouseEnter={() => setHovered({ bucket: i, outcome: `tie` })}
                      onMouseLeave={() => setHovered(null)}
                    />
                    <rect
                      x={stackedX}
                      y={lossTopY}
                      width={stackedW}
                      height={Math.max(0, tieTopY - lossTopY)}
                      fill="transparent"
                      style={{ cursor: `pointer` }}
                      onMouseEnter={() => setHovered({ bucket: i, outcome: `loss` })}
                      onMouseLeave={() => setHovered(null)}
                    />
                  </>
                ) : (
                  <>
                    <rect
                      x={cx - groupSlot / 2}
                      y={PAD_T}
                      width={groupSlot / 3}
                      height={INNER_H}
                      fill="transparent"
                      style={{ cursor: `pointer` }}
                      onMouseEnter={() => setHovered({ bucket: i, outcome: `pass` })}
                      onMouseLeave={() => setHovered(null)}
                    />
                    <rect
                      x={cx - groupSlot / 6}
                      y={PAD_T}
                      width={groupSlot / 3}
                      height={INNER_H}
                      fill="transparent"
                      style={{ cursor: `pointer` }}
                      onMouseEnter={() => setHovered({ bucket: i, outcome: `tie` })}
                      onMouseLeave={() => setHovered(null)}
                    />
                    <rect
                      x={cx + groupSlot / 6}
                      y={PAD_T}
                      width={groupSlot / 3}
                      height={INNER_H}
                      fill="transparent"
                      style={{ cursor: `pointer` }}
                      onMouseEnter={() => setHovered({ bucket: i, outcome: `loss` })}
                      onMouseLeave={() => setHovered(null)}
                    />
                  </>
                )}
              </g>
            );
          })}
          {tooltipNode}
        </svg>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-green-600" />
            {t(`Pass`)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-gray-400" />
            {t(`Tie`)}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-red-500" />
            {t(`Loss`)}
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
