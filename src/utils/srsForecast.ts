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
export function forecastDueDays(
  card: SrsCard,
  today: number,
  horizonMs: number,
  useEase: boolean,
): number[] {
  if (card.status === "dropped" || card.status === "new") return [];
  if (card.lastReviewed === null) return [];
  const multiplier = useEase ? computeEase(card.reviewHistory) : INTERVAL_MULTIPLIER;
  let interval = card.currentInterval > 0 ? card.currentInterval : INITIAL_INTERVAL;
  let nextDue = Math.max(today, dayStart(card.lastReviewed + card.currentInterval));
  const days: number[] = [];
  while (nextDue <= horizonMs) {
    days.push(nextDue);
    interval = Math.round(interval * multiplier);
    nextDue = dayStart(nextDue + interval);
  }
  return days;
}
