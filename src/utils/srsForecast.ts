import { computeEase, INITIAL_INTERVAL, INTERVAL_MULTIPLIER } from "./srs";
import type { ReviewEntry } from "./srs";

export interface SrsCard {
  status: string;
  lastReviewed: number | null;
  currentInterval: number;
  reviewHistory?: ReviewEntry[];
}

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// The forecast assumes every future review is correct. Under that assumption the
// multiplier never changes (correct = ease delta 0), so we resolve it once at the start
// and apply it each iteration.
//   useEase=true  → per-card ease (from history)
//   useEase=false → fixed INTERVAL_MULTIPLIER, matching the scheduling behavior in that mode
// Returns each future due time within [fromMs, horizonMs]. With `dayAligned: true`, each
// time is floored to the local day-start (current behavior for day-grain charts). With
// `dayAligned: false`, the raw lastReviewed + interval timestamps are preserved (used for
// the hour-grain 48h view).
export function forecastDueTimes(
  card: SrsCard,
  fromMs: number,
  horizonMs: number,
  useEase: boolean,
  dayAligned: boolean,
): number[] {
  if (card.status === "dropped" || card.status === "new") return [];
  if (card.lastReviewed === null) return [];
  const multiplier = useEase ? computeEase(card.reviewHistory) : INTERVAL_MULTIPLIER;
  const align = (ts: number): number => (dayAligned ? dayStart(ts) : ts);
  let interval = card.currentInterval > 0 ? card.currentInterval : INITIAL_INTERVAL;
  let nextDue = Math.max(fromMs, align(card.lastReviewed + card.currentInterval));
  const times: number[] = [];
  while (nextDue <= horizonMs) {
    times.push(nextDue);
    interval = Math.round(interval * multiplier);
    nextDue = align(nextDue + interval);
  }
  return times;
}
