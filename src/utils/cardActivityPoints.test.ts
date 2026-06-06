import { describe, expect, it } from "vitest";
import {
  GRAMMAR_NEW_PTS,
  GRAMMAR_REVIEW_PTS,
  VOCAB_NEW_PTS,
  VOCAB_REVIEW_PTS,
  getDailyGrammarPoints,
  getDailyVocabPoints,
} from "./cardActivityPoints";
import { addFlashcard, patchFlashcard, loadFlashcards } from "./flashcards";
import { addGrammarCards, patchGrammarCard, loadGrammarCards } from "./grammarCards";

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

describe("getDailyVocabPoints", () => {
  it("credits VOCAB_NEW_PTS for the day the card was added, and VOCAB_REVIEW_PTS per review", async () => {
    const now = Date.now();
    const today = dayStart(now);
    const card = (await addFlashcard(`Spanish`, `lluvia`, `rain`))!;
    // Two reviews today.
    await patchFlashcard(card.id, {
      reviewHistory: [
        { outcome: `correct`, timestamp: now, currentInterval: 0 },
        { outcome: `incorrect`, timestamp: now, currentInterval: 0 },
      ],
    });
    const { byDay } = await getDailyVocabPoints(`Spanish`);
    expect(byDay.get(today)).toBe(VOCAB_NEW_PTS + 2 * VOCAB_REVIEW_PTS);
  });

  it("splits review credits across days when the timestamps fall on different days", async () => {
    const now = Date.now();
    const today = dayStart(now);
    const yesterday = today - 24 * 60 * 60 * 1000;
    const card = (await addFlashcard(`Spanish`, `nube`, `cloud`))!;
    await patchFlashcard(card.id, {
      addedAt: yesterday + 60_000, // pretend the card was added yesterday
      reviewHistory: [
        { outcome: `correct`, timestamp: yesterday + 120_000, currentInterval: 0 },
        { outcome: `correct`, timestamp: now, currentInterval: 0 },
      ],
    });
    const { byDay } = await getDailyVocabPoints(`Spanish`);
    expect(byDay.get(yesterday)).toBe(VOCAB_NEW_PTS + VOCAB_REVIEW_PTS);
    expect(byDay.get(today)).toBe(VOCAB_REVIEW_PTS);
  });

  it("only counts cards in the requested language", async () => {
    const now = Date.now();
    const today = dayStart(now);
    await addFlashcard(`Spanish`, `a`, `A`);
    await addFlashcard(`French`, `b`, `B`);
    const { byDay: spanish } = await getDailyVocabPoints(`Spanish`);
    const { byDay: french } = await getDailyVocabPoints(`French`);
    expect(spanish.get(today)).toBe(VOCAB_NEW_PTS);
    expect(french.get(today)).toBe(VOCAB_NEW_PTS);
    // confirm the loadFlashcards-level isolation (no cross-contamination)
    expect((await loadFlashcards(`Spanish`)).length).toBe(1);
  });
});

describe("getDailyGrammarPoints", () => {
  const rawCard = (title: string) => ({
    title,
    prompt: `prompt`,
    tags: [],
    questions: [
      { type: `multiple-choice` as const, prompt: `q`, choices: [`a`, `b`], answer: `a` },
    ],
  });

  it("credits GRAMMAR_NEW_PTS per generated card and GRAMMAR_REVIEW_PTS per review", async () => {
    const now = Date.now();
    const today = dayStart(now);
    await addGrammarCards(`Spanish`, [rawCard(`a`)], 20);
    const [card] = await loadGrammarCards(`Spanish`);
    await patchGrammarCard(card.id, {
      reviewHistory: [
        { outcome: `correct`, timestamp: now, currentInterval: 0 },
        { outcome: `correct`, timestamp: now, currentInterval: 0 },
        { outcome: `incorrect`, timestamp: now, currentInterval: 0 },
      ],
    });
    const { byDay } = await getDailyGrammarPoints(`Spanish`);
    expect(byDay.get(today)).toBe(GRAMMAR_NEW_PTS + 3 * GRAMMAR_REVIEW_PTS);
  });

  it("scales linearly across many cards on the same day", async () => {
    const now = Date.now();
    const today = dayStart(now);
    await addGrammarCards(`Spanish`, [rawCard(`a`), rawCard(`b`), rawCard(`c`)], 20);
    const { byDay } = await getDailyGrammarPoints(`Spanish`);
    expect(byDay.get(today)).toBe(3 * GRAMMAR_NEW_PTS);
  });
});

describe("grammar is worth more per card than vocab", () => {
  it("GRAMMAR_NEW_PTS > VOCAB_NEW_PTS and GRAMMAR_REVIEW_PTS > VOCAB_REVIEW_PTS", () => {
    expect(GRAMMAR_NEW_PTS).toBeGreaterThan(VOCAB_NEW_PTS);
    expect(GRAMMAR_REVIEW_PTS).toBeGreaterThan(VOCAB_REVIEW_PTS);
  });
  it("new cards are worth more than review cards in both", () => {
    expect(VOCAB_NEW_PTS).toBeGreaterThan(VOCAB_REVIEW_PTS);
    expect(GRAMMAR_NEW_PTS).toBeGreaterThan(GRAMMAR_REVIEW_PTS);
  });
});
