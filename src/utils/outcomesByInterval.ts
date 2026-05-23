import type { ReviewEntry } from "./flashcards";

export interface IntervalOutcomes {
  intervalMs: number;
  correct: number;
  incorrect: number;
}

export interface DayOutcomes {
  dayStart: number; // local-midnight timestamp of the calendar day
  correct: number;
  incorrect: number;
}

export interface HourOutcomes {
  hour: number; // 0-23 local hour-of-day
  correct: number;
  incorrect: number;
}

function localDayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const DAY_MS = 24 * 60 * 60 * 1000;

// Aggregates every review entry across all cards into per-calendar-day correct/incorrect
// counts. Result is sorted ascending and gaps are filled with zero-count days so the
// chart x-axis reads as a continuous timeline.
export function aggregateOutcomesByDay(cards: { reviewHistory?: ReviewEntry[] }[]): DayOutcomes[] {
  const buckets = new Map<number, { correct: number; incorrect: number }>();
  for (const card of cards) {
    const history = card.reviewHistory;
    if (!history) continue;
    for (const entry of history) {
      const key = localDayStart(entry.timestamp);
      const slot = buckets.get(key) ?? { correct: 0, incorrect: 0 };
      if (entry.outcome === `correct`) slot.correct++;
      else slot.incorrect++;
      buckets.set(key, slot);
    }
  }
  if (buckets.size === 0) return [];
  const keys = [...buckets.keys()];
  const min = Math.min(...keys);
  const max = Math.max(...keys);
  const out: DayOutcomes[] = [];
  for (let d = min; d <= max; d += DAY_MS) {
    const b = buckets.get(d) ?? { correct: 0, incorrect: 0 };
    out.push({ dayStart: d, ...b });
  }
  return out;
}

// Aggregates every review entry into 24 hour-of-day buckets (local time). All 24 hours
// are returned, even those with zero reviews, so the x-axis is always a full day.
export function aggregateOutcomesByHour(
  cards: { reviewHistory?: ReviewEntry[] }[],
): HourOutcomes[] {
  const buckets: HourOutcomes[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    correct: 0,
    incorrect: 0,
  }));
  for (const card of cards) {
    const history = card.reviewHistory;
    if (!history) continue;
    for (const entry of history) {
      const h = new Date(entry.timestamp).getHours();
      if (entry.outcome === `correct`) buckets[h].correct++;
      else buckets[h].incorrect++;
    }
  }
  return buckets;
}

// Aggregates every review entry across all cards into per-interval correct/incorrect
// counts. Result is sorted by interval ascending so the chart x-axis reads left-to-right
// short → long.
export function aggregateOutcomesByInterval(
  cards: { reviewHistory?: ReviewEntry[] }[],
): IntervalOutcomes[] {
  const buckets = new Map<number, { correct: number; incorrect: number }>();
  for (const card of cards) {
    const history = card.reviewHistory;
    if (!history) continue;
    for (const entry of history) {
      const slot = buckets.get(entry.currentInterval) ?? { correct: 0, incorrect: 0 };
      if (entry.outcome === `correct`) slot.correct++;
      else slot.incorrect++;
      buckets.set(entry.currentInterval, slot);
    }
  }
  return Array.from(buckets.entries())
    .map(([intervalMs, counts]) => ({ intervalMs, ...counts }))
    .sort((a, b) => a.intervalMs - b.intervalMs);
}

const DAY = 24 * 60 * 60 * 1000;

// Compact label for an interval in milliseconds. Uses days for short, weeks/months/years
// for longer intervals to keep x-axis labels readable.
export function formatIntervalLabel(ms: number): string {
  const days = Math.round(ms / DAY);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}m`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}
