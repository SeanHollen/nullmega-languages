import type { ReviewEntry } from "./flashcards";
import { computeEase } from "./srs";

export interface IntervalBucketOutcomes {
  bucketIndex: number;
  bucketLabel: string;
  correct: number;
  incorrect: number;
}

export interface EaseOutcomes {
  bucketLabel: string;
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

const DAY = 24 * 60 * 60 * 1000;

// Anki-style interval bands: [<1d, 1–3d, 3–7d, 7–14d, 14–30d, 30–90d, 90d–1y, 1y+].
// Each entry is the inclusive lower bound (in ms); a review with currentInterval ∈ [b, next)
// falls into that bucket. The final bucket has no upper bound.
const INTERVAL_BUCKET_BOUNDS_MS: number[] = [
  0,
  DAY,
  3 * DAY,
  7 * DAY,
  14 * DAY,
  30 * DAY,
  90 * DAY,
  365 * DAY,
];
const INTERVAL_BUCKET_LABELS: string[] = [
  `<1d`,
  `1–3d`,
  `3–7d`,
  `7–14d`,
  `14–30d`,
  `30–90d`,
  `90d–1y`,
  `1y+`,
];

function bucketIndexFor(intervalMs: number): number {
  for (let i = INTERVAL_BUCKET_BOUNDS_MS.length - 1; i >= 0; i--) {
    if (intervalMs >= INTERVAL_BUCKET_BOUNDS_MS[i]) return i;
  }
  return 0;
}

// Aggregates every review entry across all cards into Anki-style interval bands.
// Returns one entry per band, in band order (shortest → longest).
export function aggregateOutcomesByIntervalBucket(
  cards: { reviewHistory?: ReviewEntry[] }[],
): IntervalBucketOutcomes[] {
  const buckets: IntervalBucketOutcomes[] = INTERVAL_BUCKET_LABELS.map((bucketLabel, i) => ({
    bucketIndex: i,
    bucketLabel,
    correct: 0,
    incorrect: 0,
  }));
  for (const card of cards) {
    const history = card.reviewHistory;
    if (!history) continue;
    for (const entry of history) {
      const i = bucketIndexFor(entry.currentInterval);
      if (entry.outcome === `correct`) buckets[i].correct++;
      else buckets[i].incorrect++;
    }
  }
  return buckets;
}

// Ease bins (8 buckets). Each card's full review history is attributed to the
// bucket matching that card's CURRENT ease.
const EASE_BUCKET_BOUNDS: number[] = [-Infinity, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.3];
const EASE_BUCKET_LABELS: string[] = [
  `<1.5`,
  `1.5–1.8`,
  `1.8–2.1`,
  `2.1–2.4`,
  `2.4–2.7`,
  `2.7–3.0`,
  `3.0–3.3`,
  `3.3+`,
];

function easeBucketIndexFor(ease: number): number {
  for (let i = EASE_BUCKET_BOUNDS.length - 1; i >= 0; i--) {
    if (ease >= EASE_BUCKET_BOUNDS[i]) return i;
  }
  return 0;
}

export function aggregateOutcomesByEase(
  cards: { reviewHistory?: ReviewEntry[] }[],
): EaseOutcomes[] {
  const buckets: EaseOutcomes[] = EASE_BUCKET_LABELS.map((bucketLabel) => ({
    bucketLabel,
    correct: 0,
    incorrect: 0,
  }));
  for (const card of cards) {
    const history = card.reviewHistory;
    if (!history || history.length === 0) continue;
    const ease = computeEase(history);
    const i = easeBucketIndexFor(ease);
    for (const entry of history) {
      if (entry.outcome === `correct`) buckets[i].correct++;
      else buckets[i].incorrect++;
    }
  }
  return buckets;
}

// Compact label for an interval in milliseconds. Uses days for short, weeks/months/years
// for longer intervals to keep x-axis labels readable.
export function formatIntervalLabel(ms: number): string {
  const days = Math.round(ms / DAY);
  if (days < 7) return `${days}d`;
  if (days < 30) return `${Math.round(days / 7)}w`;
  if (days < 365) return `${Math.round(days / 30)}m`;
  return `${Math.round((days / 365) * 10) / 10}y`;
}
