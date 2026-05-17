import { INITIAL_INTERVAL, nextInterval } from "./studySession";

export interface SrsCard {
  status: string;
  lastReviewed: number | null;
  currentInterval: number;
}

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function forecastDueDays(card: SrsCard, today: number, horizonMs: number): number[] {
  if (card.status === "dropped" || card.status === "new") return [];
  if (card.lastReviewed === null) return [];
  let interval = card.currentInterval > 0 ? card.currentInterval : INITIAL_INTERVAL;
  let nextDue = Math.max(today, dayStart(card.lastReviewed + card.currentInterval));
  const days: number[] = [];
  while (nextDue <= horizonMs) {
    days.push(nextDue);
    interval = nextInterval(interval);
    nextDue = dayStart(nextDue + interval);
  }
  return days;
}
