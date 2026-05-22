import type { Flashcard } from "./flashcards";

const TARGET_MIN = 5;
const TARGET_MAX = 8;
const DAY = 24 * 60 * 60 * 1000;

// Half-life in days for the due-time weighting. A card due `HALF_LIFE_DAYS` from now
// is half as likely to be picked as one due today. Smaller = more aggressive bias
// toward imminent cards; larger = more diverse sampling across the future.
const HALF_LIFE_DAYS = 1;

function dueTimeOf(card: Flashcard): number {
  return (card.lastReviewed ?? 0) + card.currentInterval;
}

// Exponential decay: weight = 2^(-daysUntilDue / HALF_LIFE_DAYS). Already-due cards get
// weight 1 (max); cards a day out get weight 0.5; a week out gets weight ~0.008.
function dueWeight(card: Flashcard, now: number): number {
  const daysUntilDue = Math.max(0, (dueTimeOf(card) - now) / DAY);
  return Math.pow(2, -daysUntilDue / HALF_LIFE_DAYS);
}

// Efraimidis–Spirakis weighted sampling without replacement: assign each item the
// random key `u^(1/weight)`, take the top-`n` by key. Equivalent to a streaming
// reservoir sample, fully unbiased w.r.t. the supplied weights.
function weightedSample<T>(items: T[], weights: number[], n: number, rng: () => number): T[] {
  if (n >= items.length) return [...items];
  const keys = items.map((_, i) => {
    const w = Math.max(weights[i], 1e-12);
    return Math.pow(rng(), 1 / w);
  });
  return items
    .map((item, i) => ({ item, key: keys[i] }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.item);
}

// Picks vocab words for the vocab-paragraph writing mode. Heavily biases toward
// cards about to come due, but doesn't strictly sort by due time — cards a few
// seconds apart get effectively equal weight, so the same five words don't get
// picked every session. Returns [] when there are no upcoming (scheduled) cards.
export function pickUpcomingVocabWords(
  cards: Flashcard[],
  rng: () => number = Math.random,
  now: number = Date.now(),
): Flashcard[] {
  const eligible = cards.filter((c) => c.status === `scheduled`);
  if (eligible.length === 0) return [];

  const target = TARGET_MIN + Math.floor(rng() * (TARGET_MAX - TARGET_MIN + 1));
  const weights = eligible.map((c) => dueWeight(c, now));
  return weightedSample(eligible, weights, target, rng);
}
