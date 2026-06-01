import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { UsageCategory, UsageRow } from "../../utils/apiUsage";
import { USAGE_CATEGORIES } from "../../utils/apiUsage";
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

type Window = "7" | "30" | "90";

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_COLOR: Record<UsageCategory, string> = {
  reading: `#16a34a`,
  listening: `#f59e0b`,
  writing: `#0ea5e9`,
  pronunciation: `#a855f7`,
  vocabulary: `#ec4899`,
  grammar: `#14b8a6`,
};

interface DayBucket {
  t: number;
  // costs per category, in USD
  byCategory: Record<UsageCategory, number>;
  total: number;
}

function buildBuckets(rows: UsageRow[], days: number): DayBucket[] {
  const today = dayStart(Date.now());
  const startDay = today - (days - 1) * DAY_MS;
  const buckets: DayBucket[] = [];
  for (let i = 0; i < days; i++) {
    const t = startDay + i * DAY_MS;
    const byCategory = Object.fromEntries(USAGE_CATEGORIES.map((c) => [c, 0])) as Record<
      UsageCategory,
      number
    >;
    buckets.push({ t, byCategory, total: 0 });
  }
  for (const r of rows) {
    const day = dayStart(r.timestamp);
    if (day < startDay || day > today) continue;
    const idx = Math.round((day - startDay) / DAY_MS);
    if (!buckets[idx]) continue;
    buckets[idx].byCategory[r.category] += r.costUsd;
    buckets[idx].total += r.costUsd;
  }
  return buckets;
}

function formatUsd(value: number): string {
  if (value === 0) return `$0`;
  if (value < 0.01) return `$${value.toFixed(4)}`;
  if (value < 1) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

interface Props {
  rows: UsageRow[];
}

export function UsageByDayChart({ rows }: Props) {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState<Window>(`30`);
  const [hovered, setHovered] = useState<{ bucket: number; category: UsageCategory } | null>(null);

  const days = Number(windowDays);
  const buckets = buildBuckets(rows, days);
  const totalCost = buckets.reduce((s, b) => s + b.total, 0);
  const maxDaily = Math.max(0.0001, ...buckets.map((b) => b.total));
  const high = maxDaily * 1.1;
  const ticks = [0, high / 2, high];

  const groupSlot = INNER_W / Math.max(1, buckets.length);
  const barW = Math.min(20, Math.max(2, groupSlot * 0.7));

  function groupX(i: number): number {
    return PAD_L + i * groupSlot + groupSlot / 2;
  }
  function toY(value: number): number {
    return PAD_T + INNER_H - (value / high) * INNER_H;
  }

  const CATEGORY_LABEL: Record<UsageCategory, string> = {
    reading: t(`Reading`),
    listening: t(`Listening`),
    writing: t(`Writing`),
    pronunciation: t(`Pronunciation`),
    vocabulary: t(`Vocabulary`),
    grammar: t(`Grammar`),
  };

  let tooltipNode: React.ReactNode = null;
  if (hovered && buckets[hovered.bucket]) {
    const b = buckets[hovered.bucket];
    const value = b.byCategory[hovered.category];
    // tooltip anchored at the top of the stacked segment for the hovered category
    let runningHeight = 0;
    for (const cat of USAGE_CATEGORIES) {
      if (cat === hovered.category) break;
      runningHeight += b.byCategory[cat];
    }
    const topVal = runningHeight + value;
    const ty = toY(topVal);
    tooltipNode = renderTooltip(groupX(hovered.bucket), ty, [
      shortDate(b.t),
      `${CATEGORY_LABEL[hovered.category]}: ${formatUsd(value)}`,
      t(`Day total {{value}}`, { value: formatUsd(b.total) }),
    ]);
  }

  function dayLabel(i: number, ts: number): string | null {
    const d = new Date(ts);
    const dayOfMonth = d.getDate();
    const labelEvery = Math.max(1, Math.floor(buckets.length / 10));
    if (i % labelEvery !== 0 && i !== buckets.length - 1) return null;
    return String(dayOfMonth);
  }

  return (
    <ChartCard
      title={t(`Cost per day`)}
      right={
        <ChartToggle
          value={windowDays}
          options={[
            [`7`, t(`7d`)],
            [`30`, t(`30d`)],
            [`90`, t(`90d`)],
          ]}
          onChange={(next) => {
            setWindowDays(next);
            setHovered(null);
          }}
        />
      }
      trailing={
        <div className="text-sm text-right">
          <span className="text-gray-500">{t(`Total in window:`)} </span>
          <span className="font-semibold text-gray-800">{formatUsd(totalCost)}</span>
        </div>
      }
    >
      {totalCost === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">
          {t(`No BYOK calls recorded in this window.`)}
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={t(`Cost per day`)}
        >
          <ChartFrame ticks={ticks} toY={toY} formatTick={formatUsd} />
          {buckets.map((b, i) => {
            const cx = groupX(i);
            const baseY = toY(0);
            const stackedX = cx - barW / 2;
            let runningTop = baseY;
            const segments: React.ReactNode[] = [];
            for (const cat of USAGE_CATEGORIES) {
              const value = b.byCategory[cat];
              if (value <= 0) continue;
              const segH = (value / high) * INNER_H;
              const segTop = runningTop - segH;
              segments.push(
                <rect
                  key={`bar-${cat}`}
                  x={stackedX}
                  y={segTop}
                  width={barW}
                  height={segH}
                  fill={CATEGORY_COLOR[cat]}
                  opacity={hovered?.bucket === i && hovered.category === cat ? 0.8 : 1}
                />,
              );
              segments.push(
                <rect
                  key={`hit-${cat}`}
                  x={stackedX}
                  y={segTop}
                  width={barW}
                  height={segH}
                  fill="transparent"
                  style={{ cursor: `pointer` }}
                  onMouseEnter={() => setHovered({ bucket: i, category: cat })}
                  onMouseLeave={() => setHovered(null)}
                />,
              );
              runningTop = segTop;
            }
            const label = dayLabel(i, b.t);
            return (
              <g key={b.t}>
                {segments}
                {label && (
                  <text
                    x={cx}
                    y={CHART_HEIGHT - PAD_B + 14}
                    textAnchor="middle"
                    className="fill-gray-500"
                    fontSize="10"
                  >
                    {label}
                  </text>
                )}
              </g>
            );
          })}
          {tooltipNode}
        </svg>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        {USAGE_CATEGORIES.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: CATEGORY_COLOR[c] }} />
            {CATEGORY_LABEL[c]}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}
