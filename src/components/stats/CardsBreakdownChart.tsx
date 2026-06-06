import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { SrsCardWithStatus } from "./SrsStatsView";
import { formatIntervalLabel } from "../../utils/outcomesByInterval";
import { computeEase } from "../../utils/srs";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  ChartCard,
  ChartFrame,
  ChartToggle,
  INNER_W,
  PAD_B,
  PAD_L,
  PAD_T,
  renderTooltip,
} from "./chartCommon";

type CardsMode = "status" | "interval" | "accuracy" | "ease";

const STATUSES = [`new`, `learning`, `relearning`, `due`, `scheduled`, `dropped`] as const;

const STATUS_COLOR: Record<string, string> = {
  new: `#9ca3af`,
  learning: `#f59e0b`,
  relearning: `#ef4444`,
  due: `#f97316`,
  scheduled: `#0ea5e9`,
  dropped: `#d1d5db`,
};

interface CardsBucket {
  label: string;
  count: number;
  color: string;
  tooltipLabel?: string;
}

interface BucketResult {
  buckets: CardsBucket[];
  // Count of cards in the "excluded" category for non-status modes: cards without an
  // interval yet (interval mode) or without any review history (ease mode). Rendered
  // subtly below the chart instead of as a bar, so the user can still see they exist.
  excludedCount?: number;
  excludedLabel?: string;
}

function buildBuckets(cards: SrsCardWithStatus[], mode: CardsMode, t: TFunction): BucketResult {
  if (mode === `status`) {
    return {
      buckets: STATUSES.map((s) => ({
        label: t(s),
        count: cards.filter((c) => c.status === s).length,
        color: STATUS_COLOR[s] ?? `#9ca3af`,
      })).filter((b) => b.count > 0),
    };
  }
  if (mode === `interval`) {
    const byLabel = new Map<string, { sortKey: number; count: number }>();
    let noInterval = 0;
    for (const c of cards) {
      if (c.currentInterval === 0) {
        noInterval++;
        continue;
      }
      const label = formatIntervalLabel(c.currentInterval);
      const entry = byLabel.get(label);
      if (entry) {
        entry.count++;
      } else {
        byLabel.set(label, { sortKey: c.currentInterval, count: 1 });
      }
    }
    const buckets: CardsBucket[] = [...byLabel.entries()]
      .sort((a, b) => a[1].sortKey - b[1].sortKey)
      .map(([label, { count }]) => ({
        label,
        count,
        color: `#0ea5e9`,
      }));
    return {
      buckets,
      excludedCount: noInterval,
      excludedLabel: t(`with no interval yet`),
    };
  }
  if (mode === `accuracy`) {
    // Bucket cards by accuracy on reviewHistory (correct / total). "How often the user
    // got it right when the card came due." Cards with no review history are excluded.
    const accuracyBuckets: CardsBucket[] = [
      { label: `0-25%`, color: `#ef4444`, count: 0, tooltipLabel: t(`0-25% correct`) },
      { label: `26-50%`, color: `#f97316`, count: 0, tooltipLabel: t(`26-50% correct`) },
      { label: `51-75%`, color: `#f59e0b`, count: 0, tooltipLabel: t(`51-75% correct`) },
      { label: `76-99%`, color: `#84cc16`, count: 0, tooltipLabel: t(`76-99% correct`) },
      { label: `100%`, color: `#16a34a`, count: 0, tooltipLabel: t(`100% correct`) },
    ];
    let untested = 0;
    for (const c of cards) {
      const history = c.reviewHistory ?? [];
      if (history.length === 0) {
        untested++;
        continue;
      }
      const correct = history.filter((e) => e.outcome === `correct`).length;
      const ratio = correct / history.length;
      if (ratio === 1) accuracyBuckets[4].count++;
      else if (ratio >= 0.76) accuracyBuckets[3].count++;
      else if (ratio >= 0.51) accuracyBuckets[2].count++;
      else if (ratio >= 0.26) accuracyBuckets[1].count++;
      else accuracyBuckets[0].count++;
    }
    return { buckets: accuracyBuckets, excludedCount: untested, excludedLabel: t(`untested`) };
  }
  // ease: bucket cards by the SM-2 ease multiplier computed from reviewHistory.
  // With correct=q4 and incorrect=q1, the only reachable ease values are 1.30 (floor,
  // 3+ lapses), 1.42 (2 lapses), 1.96 (1 lapse), and 2.50 (0 lapses) — so the buckets
  // are sized to land each on its own bar.
  const easeBuckets: CardsBucket[] = [
    { label: `130%`, color: `#ef4444`, count: 0, tooltipLabel: t(`130% ease (floor)`) },
    { label: `~140%`, color: `#f97316`, count: 0, tooltipLabel: t(`~140% ease`) },
    { label: `~200%`, color: `#f59e0b`, count: 0, tooltipLabel: t(`~200% ease`) },
    { label: `250%`, color: `#16a34a`, count: 0, tooltipLabel: t(`250% ease (default)`) },
  ];
  let untested = 0;
  for (const c of cards) {
    const history = c.reviewHistory ?? [];
    if (history.length === 0) {
      untested++;
      continue;
    }
    const ease = computeEase(history);
    if (ease >= 2.2) easeBuckets[3].count++;
    else if (ease >= 1.7) easeBuckets[2].count++;
    else if (ease >= 1.35) easeBuckets[1].count++;
    else easeBuckets[0].count++;
  }
  return { buckets: easeBuckets, excludedCount: untested, excludedLabel: t(`untested`) };
}

interface Props {
  cards: SrsCardWithStatus[];
  emptyMessage: string;
}

export function CardsBreakdownChart({ cards, emptyMessage }: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<CardsMode>(`status`);
  const [hovered, setHovered] = useState<number | null>(null);

  const { buckets, excludedCount, excludedLabel } = buildBuckets(cards, mode, t);
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));
  const barSlot = buckets.length > 0 ? INNER_W / buckets.length : INNER_W;
  const barW = Math.min(80, barSlot * 0.6);
  const ticks = [0, Math.round(maxCount / 2), maxCount];
  const totalCards = cards.length;

  function barX(i: number): number {
    return PAD_L + i * barSlot + barSlot / 2;
  }
  function toY(count: number): number {
    return (
      PAD_T + (CHART_HEIGHT - PAD_T - PAD_B) - (count / maxCount) * (CHART_HEIGHT - PAD_T - PAD_B)
    );
  }

  return (
    <ChartCard
      title={t(`Cards`)}
      right={
        <ChartToggle
          value={mode}
          options={[
            [`status`, t(`Status`)],
            [`interval`, t(`Interval`)],
            [`accuracy`, t(`Accuracy`)],
            [`ease`, t(`Ease`)],
          ]}
          onChange={(next) => {
            setMode(next);
            setHovered(null);
          }}
        />
      }
      trailing={
        <div className="text-sm text-right">
          <span className="text-gray-500">{t(`Total:`)} </span>
          <span className="font-semibold text-gray-800">{totalCards}</span>
        </div>
      }
    >
      {totalCards === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">{emptyMessage}</p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={t(`Cards breakdown`)}
        >
          <ChartFrame ticks={ticks} toY={toY} />
          {buckets.map((b, i) => {
            const bx = barX(i) - barW / 2;
            const by = toY(b.count);
            const bh = Math.max(0, toY(0) - by);
            return (
              <g key={i}>
                <rect
                  x={bx}
                  y={by}
                  width={barW}
                  height={bh}
                  fill={b.color}
                  opacity={hovered === i ? 0.8 : 1}
                  rx="2"
                />
                <text
                  x={barX(i)}
                  y={CHART_HEIGHT - PAD_B + 16}
                  textAnchor="middle"
                  className="fill-gray-500"
                  fontSize="11"
                >
                  {b.label}
                </text>
                <rect
                  x={barX(i) - barSlot / 2}
                  y={PAD_T}
                  width={barSlot}
                  height={CHART_HEIGHT - PAD_T - PAD_B}
                  fill="transparent"
                  style={{ cursor: `pointer` }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                />
              </g>
            );
          })}
          {hovered !== null &&
            renderTooltip(barX(hovered), toY(buckets[hovered].count), [
              buckets[hovered].tooltipLabel ?? buckets[hovered].label,
              buckets[hovered].count === 1
                ? t(`{{count}} card`, { count: buckets[hovered].count })
                : t(`{{count}} cards`, { count: buckets[hovered].count }),
            ])}
          {excludedCount !== undefined && excludedCount > 0 && (
            <text x={PAD_L} y={CHART_HEIGHT - 2} className="fill-gray-400" fontSize="10">
              {excludedCount === 1
                ? t(`{{count}} card {{label}}`, { count: excludedCount, label: excludedLabel })
                : t(`{{count}} cards {{label}}`, { count: excludedCount, label: excludedLabel })}
            </text>
          )}
        </svg>
      )}
    </ChartCard>
  );
}
