import { useLiveQuery } from "dexie-react-hooks";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { BackHeader } from "../components/BackHeader";
import { loadStreaks, computeCurrentStreak, dateStr, type StreakRecord } from "../utils/streaks";
import { loadListeningSeconds, formatListeningDuration } from "../utils/listeningStats";
import { useLanguage } from "../contexts/LanguageContext";
import { useDayKey } from "../hooks/useDayKey";
import { PointsPerDayByModeChart } from "../components/stats/PointsPerDayByModeChart";

const WEEKS = 26;
const DAY_LABELS = [`Sun`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`];
const MONTH_NAMES = [
  `Jan`,
  `Feb`,
  `Mar`,
  `Apr`,
  `May`,
  `Jun`,
  `Jul`,
  `Aug`,
  `Sep`,
  `Oct`,
  `Nov`,
  `Dec`,
];

interface Cell {
  date: Date;
  key: string;
  record: StreakRecord | undefined;
  isFuture: boolean;
  isToday: boolean;
}

function cellColor(cell: Cell): string {
  if (cell.isFuture) return `bg-transparent`;
  if (cell.record?.complete && cell.record.hadObligations) return `bg-green-600`;
  if (cell.isToday) return `bg-indigo-500`;
  if (!cell.record) return `bg-gray-100`;
  return `bg-slate-300`;
}

function cellTitle(cell: Cell, t: TFunction): string {
  const d = cell.date.toLocaleDateString();
  if (cell.isFuture) return d;
  if (cell.record?.complete && cell.record.hadObligations)
    return t(`{{date}} — all goals met`, { date: d });
  if (cell.isToday) return t(`{{date}} — in progress`, { date: d });
  if (!cell.record) return t(`{{date}} — not visited`, { date: d });
  return t(`{{date}} — visited`, { date: d });
}

export function StreaksPage() {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const dayKey = useDayKey();
  const records = useLiveQuery(() => loadStreaks(language), [language, dayKey]) ?? [];
  const byDate = new Map(records.map((r) => [r.date, r]));
  const currentStreak = computeCurrentStreak(records);
  const listeningSeconds = useLiveQuery(() => loadListeningSeconds(), []) ?? 0;

  const today = new Date(dayKey);

  // The rightmost column holds today's week. Start from the Sunday WEEKS-1 weeks before
  // the Sunday of this week.
  const thisSunday = new Date(today);
  thisSunday.setDate(today.getDate() - today.getDay());
  const startSunday = new Date(thisSunday);
  startSunday.setDate(thisSunday.getDate() - (WEEKS - 1) * 7);

  const weeks: Cell[][] = [];
  for (let w = 0; w < WEEKS; w++) {
    const col: Cell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(startSunday);
      date.setDate(startSunday.getDate() + w * 7 + d);
      const key = dateStr(date);
      col.push({
        date,
        key,
        record: byDate.get(key),
        isFuture: date.getTime() > today.getTime(),
        isToday: date.getTime() === today.getTime(),
      });
    }
    weeks.push(col);
  }

  // Month labels above each column where the month changes (versus the previous column).
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const firstDay = weeks[w][0].date;
    if (firstDay.getMonth() !== lastMonth) {
      monthLabels.push({ col: w, label: MONTH_NAMES[firstDay.getMonth()] });
      lastMonth = firstDay.getMonth();
    }
  }

  const total = records.length;
  const greenDays = records.filter((r) => r.complete && r.hadObligations).length;

  return (
    <div className="min-h-screen bg-green-100 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <BackHeader title={t(`Streaks`)} to="/" />

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">{t(`Current streak`)}</p>
              <p className="text-3xl font-bold text-green-600">{currentStreak}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {currentStreak === 1 ? t(`day`) : t(`days`)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">{t(`Green days`)}</p>
              <p className="text-3xl font-bold text-gray-800">{greenDays}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {total > 0 ? t(`of {{total}} tracked`, { total }) : t(`no days tracked yet`)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">{t(`Time listening`)}</p>
              <p className="text-3xl font-bold text-gray-800">
                {formatListeningDuration(listeningSeconds)}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{t(`total`)}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="inline-block">
              <div className="flex gap-1 pl-7 mb-1">
                {Array.from({ length: WEEKS }).map((_, w) => {
                  const label = monthLabels.find((m) => m.col === w);
                  return (
                    <div key={w} className="w-3 text-[10px] text-gray-400">
                      {label?.label ? t(label.label) : ``}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1">
                <div className="flex flex-col gap-1 mr-1 text-[10px] text-gray-400">
                  {DAY_LABELS.map((d, i) => (
                    <div
                      key={d}
                      className="h-3 flex items-center"
                      style={{ visibility: i % 2 === 1 ? `visible` : `hidden` }}
                    >
                      {t(d)}
                    </div>
                  ))}
                </div>
                {weeks.map((col, w) => (
                  <div key={w} className="flex flex-col gap-1">
                    {col.map((cell) => (
                      <div
                        key={cell.key}
                        title={cellTitle(cell, t)}
                        className={`w-3 h-3 rounded-sm ${cellColor(cell)}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-green-600" />
              {t(`All goals met`)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-500" />
              {t(`In progress`)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-slate-300" />
              {t(`Visited`)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gray-100" />
              {t(`Not visited`)}
            </span>
          </div>
        </div>

        <PointsPerDayByModeChart language={language} />
      </div>
    </div>
  );
}
