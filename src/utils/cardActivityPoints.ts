import { loadFlashcards } from "./flashcards";
import { loadGrammarCards } from "./grammarCards";

// Per-card point values awarded for vocab and grammar activity. Small, so a heavy day
// of SRS work contributes roughly as much as one mid-difficulty passage; new cards are
// worth more than reviews (the first encounter takes more cognitive effort), and grammar
// is worth slightly more than vocab (multi-question cards demand more engagement).
export const VOCAB_NEW_PTS = 1.5;
export const VOCAB_REVIEW_PTS = 0.25;
export const GRAMMAR_NEW_PTS = 5;
export const GRAMMAR_REVIEW_PTS = 1;

export type CardKind = "vocab" | "grammar";

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Per-card constants are small floats (0.25, 0.5, etc.) and accumulate IEEE-754 noise
// across many reviews, which then surfaces as "30.299999999..." in tooltips. Round each
// running total to 2 decimals — enough resolution to preserve quarter-point increments
// exactly while still squashing the trailing-bits noise.
function addPts(byDay: Map<number, number>, day: number, pts: number): void {
  const next = (byDay.get(day) ?? 0) + pts;
  byDay.set(day, Math.round(next * 100) / 100);
}

interface DailyPoints {
  // Map from a day-start timestamp to the total points contributed by SRS activity that day.
  byDay: Map<number, number>;
}

export async function getDailyVocabPoints(language: string): Promise<DailyPoints> {
  const cards = await loadFlashcards(language);
  const byDay = new Map<number, number>();
  for (const card of cards) {
    if (typeof card.addedAt === `number`) {
      addPts(byDay, dayStart(card.addedAt), VOCAB_NEW_PTS);
    }
    for (const r of card.reviewHistory ?? []) {
      addPts(byDay, dayStart(r.timestamp), VOCAB_REVIEW_PTS);
    }
  }
  return { byDay };
}

export async function getDailyGrammarPoints(language: string): Promise<DailyPoints> {
  const cards = await loadGrammarCards(language);
  const byDay = new Map<number, number>();
  for (const card of cards) {
    if (typeof card.addedAt === `number`) {
      addPts(byDay, dayStart(card.addedAt), GRAMMAR_NEW_PTS);
    }
    for (const r of card.reviewHistory ?? []) {
      addPts(byDay, dayStart(r.timestamp), GRAMMAR_REVIEW_PTS);
    }
  }
  return { byDay };
}
