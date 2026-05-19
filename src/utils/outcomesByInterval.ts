import type { ReviewEntry } from "./flashcards";

export interface IntervalOutcomes {
  intervalMs: number;
  correct: number;
  incorrect: number;
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
