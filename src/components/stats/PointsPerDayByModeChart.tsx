import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import { getHistory, pointsForRecord } from "../../utils/history";
import type { Mode } from "../../hooks/useAbility";
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
const MODES: Mode[] = [`reading`, `writing`, `listening`, `pronunciation`];

const MODE_COLOR: Record<Mode, string> = {
  reading: `#16a34a`,
  writing: `#0ea5e9`,
  listening: `#f59e0b`,
  pronunciation: `#a855f7`,
};

interface DayBucket {
  t: number;
  byMode: Record<Mode, number>;
  total: number;
}

function buildBuckets(
  recordsByMode: Record<Mode, { completedAt: number; points: number }[]>,
  days: number,
): DayBucket[] {
  const today = dayStart(Date.now());
  const startDay = today - (days - 1) * DAY_MS;
  const buckets: DayBucket[] = [];
  for (let i = 0; i < days; i++) {
    const t = startDay + i * DAY_MS;
    const byMode = Object.fromEntries(MODES.map((m) => [m, 0])) as Record<Mode, number>;
    buckets.push({ t, byMode, total: 0 });
  }
  for (const mode of MODES) {
    for (const r of recordsByMode[mode]) {
      const day = dayStart(r.completedAt);
      if (day < startDay || day > today) continue;
      const idx = Math.round((day - startDay) / DAY_MS);
      if (!buckets[idx]) continue;
      buckets[idx].byMode[mode] += r.points;
      buckets[idx].total += r.points;
    }
  }
  return buckets;
}

interface Props {
  language: string;
}

export function PointsPerDayByModeChart({ language }: Props) {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState<Window>(`30`);
  const [hovered, setHovered] = useState<{ bucket: number; mode: Mode } | null>(null);

  const recordsByMode = useLiveQuery(async () => {
    const entries = await Promise.all(
      MODES.map(async (m) => {
        const history = await getHistory(m, language);
        return [
          m,
          history
            .filter(
              (r): r is typeof r & { completedAt: number } => typeof r.completedAt === `number`,
            )
            .map((r) => ({ completedAt: r.completedAt, points: pointsForRecord(r) })),
        ] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<Mode, { completedAt: number; points: number }[]>;
  }, [language]) ?? {
    reading: [],
    writing: [],
    listening: [],
    pronunciation: [],
  };

  const days = Number(windowDays);
  const buckets = buildBuckets(recordsByMode, days);
  const totalPoints = buckets.reduce((s, b) => s + b.total, 0);
  const maxDaily = Math.max(1, ...buckets.map((b) => b.total));
  const high = Math.max(5, Math.ceil(maxDaily * 1.1));
  const ticks = [0, Math.round(high / 2), high];

  const groupSlot = INNER_W / Math.max(1, buckets.length);
  const barW = Math.min(20, Math.max(2, groupSlot * 0.7));

  function groupX(i: number): number {
    return PAD_L + i * groupSlot + groupSlot / 2;
  }
  function toY(value: number): number {
    return PAD_T + INNER_H - (value / high) * INNER_H;
  }

  const MODE_LABEL: Record<Mode, string> = {
    reading: t(`Reading`),
    writing: t(`Writing`),
    listening: t(`Listening`),
    pronunciation: t(`Pronunciation`),
  };

  let tooltipNode: React.ReactNode = null;
  if (hovered && buckets[hovered.bucket]) {
    const b = buckets[hovered.bucket];
    const value = b.byMode[hovered.mode];
    let runningTotal = 0;
    for (const m of MODES) {
      if (m === hovered.mode) break;
      runningTotal += b.byMode[m];
    }
    const topVal = runningTotal + value;
    tooltipNode = renderTooltip(groupX(hovered.bucket), toY(topVal), [
      shortDate(b.t),
      `${MODE_LABEL[hovered.mode]}: ${value.toFixed(0)} pts`,
      t(`Day total {{points}} pts`, { points: b.total.toFixed(0) }),
    ]);
  }

  function dayLabel(i: number, ts: number): string | null {
    const labelEvery = Math.max(1, Math.floor(buckets.length / 10));
    if (i % labelEvery !== 0 && i !== buckets.length - 1) return null;
    return String(new Date(ts).getDate());
  }

  return (
    <ChartCard
      title={t(`Points per day`)}
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
          <span className="font-semibold text-gray-800">{totalPoints.toFixed(0)}</span>
        </div>
      }
    >
      {totalPoints === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">
          {t(`No exercises completed in this window.`)}
        </p>
      ) : (
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="w-full"
          role="img"
          aria-label={t(`Points per day`)}
        >
          <ChartFrame ticks={ticks} toY={toY} />
          {buckets.map((b, i) => {
            const cx = groupX(i);
            const baseY = toY(0);
            const stackedX = cx - barW / 2;
            let runningTop = baseY;
            const segments: React.ReactNode[] = [];
            for (const mode of MODES) {
              const value = b.byMode[mode];
              if (value <= 0) continue;
              const segH = (value / high) * INNER_H;
              const segTop = runningTop - segH;
              segments.push(
                <rect
                  key={`bar-${mode}`}
                  x={stackedX}
                  y={segTop}
                  width={barW}
                  height={segH}
                  fill={MODE_COLOR[mode]}
                  opacity={hovered?.bucket === i && hovered.mode === mode ? 0.8 : 1}
                />,
              );
              segments.push(
                <rect
                  key={`hit-${mode}`}
                  x={stackedX}
                  y={segTop}
                  width={barW}
                  height={segH}
                  fill="transparent"
                  style={{ cursor: `pointer` }}
                  onMouseEnter={() => setHovered({ bucket: i, mode })}
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
        {MODES.map((m) => (
          <span key={m} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: MODE_COLOR[m] }} />
            {MODE_LABEL[m]}
          </span>
        ))}
      </div>
    </ChartCard>
  );
}
