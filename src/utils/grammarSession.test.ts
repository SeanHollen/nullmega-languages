import { describe, expect, it } from "vitest";
import { pickNextGrammarCard } from "./grammarSession";
import type { GrammarCard } from "./grammarCards";
import { computeSrsAnswerPatch, INITIAL_INTERVAL, INTERVALS } from "./srs";

const DAY = 24 * 60 * 60 * 1000;

function makeCard(id: string, overrides: Partial<GrammarCard> = {}): GrammarCard {
  return {
    id,
    language: `Spanish`,
    title: `Card ${id}`,
    prompt: `prompt`,
    level: 50,
    questions: [],
    status: `scheduled`,
    lastReviewed: Date.now() - 2 * DAY,
    currentInterval: INITIAL_INTERVAL,
    addedAt: Date.now(),
    tags: [],
    relearningStartedAt: null,
    learningCorrectCount: null,
    reviewHistory: [],
    ...overrides,
  };
}

describe("grammar answer patch (via shared SRS state machine, N=1 for learn)", () => {
  it("right on a due card → scheduled, interval advanced", () => {
    const card = makeCard(`a`);
    const { patch, graduate } = computeSrsAnswerPatch(card, `review`, true, 1000, 1);
    expect(graduate).toBe(true);
    expect(patch.status).toBe(`scheduled`);
    expect(patch.lastReviewed).toBe(1000);
    expect(patch.currentInterval).toBe(INTERVALS[1]);
  });

  it("right on an initial-learning card → graduates after 1 correct (N=1)", () => {
    const card = makeCard(`a`, {
      status: `learning`,
      lastReviewed: null,
      currentInterval: 0,
      learningCorrectCount: null,
    });
    const { patch, graduate } = computeSrsAnswerPatch(card, `learn`, true, 1000, 1);
    expect(graduate).toBe(true);
    expect(patch.status).toBe(`scheduled`);
    expect(patch.currentInterval).toBe(INITIAL_INTERVAL);
  });

  it("wrong on a due card → stays scheduled, currentInterval=0, relearning flag set", () => {
    const card = makeCard(`a`, { lastReviewed: Date.now() - 10 * DAY, currentInterval: 7 * DAY });
    const { patch, graduate } = computeSrsAnswerPatch(card, `review`, false, 1000, 1);
    expect(graduate).toBe(false);
    expect(`status` in patch).toBe(false); // stays scheduled
    expect(patch.currentInterval).toBe(0);
    expect(patch.relearningStartedAt).toBe(1000);
  });

  it("right on a relearning card → graduates back to clean scheduled, INITIAL_INTERVAL", () => {
    const card = makeCard(`a`, {
      status: `scheduled`,
      lastReviewed: 500,
      currentInterval: 0,
      relearningStartedAt: 500,
    });
    const { patch, graduate } = computeSrsAnswerPatch(card, `review`, true, 1000, 1);
    expect(graduate).toBe(true);
    expect(patch.status).toBe(`scheduled`);
    expect(patch.currentInterval).toBe(INITIAL_INTERVAL);
    expect(patch.relearningStartedAt).toBeNull();
  });
});

describe("pickNextGrammarCard", () => {
  it("wrong → returns the same card (so the user retries it immediately)", () => {
    const a = makeCard(`a`);
    const b = makeCard(`b`);
    const c = makeCard(`c`);
    const { card, nextRemaining } = pickNextGrammarCard([a, b, c], a, false);
    expect(card?.id).toBe(`a`);
    expect(nextRemaining.map((x) => x.id)).toEqual([`a`, `b`, `c`]);
  });

  it("right → removes the card and picks a different one from those remaining", () => {
    const a = makeCard(`a`);
    const b = makeCard(`b`);
    const c = makeCard(`c`);
    const { card, nextRemaining } = pickNextGrammarCard([a, b, c], a, true);
    expect(card?.id).not.toBe(`a`);
    expect([`b`, `c`]).toContain(card?.id);
    expect(nextRemaining.map((x) => x.id).sort()).toEqual([`b`, `c`]);
  });

  it("right on the last card → returns null", () => {
    const a = makeCard(`a`);
    const { card, nextRemaining } = pickNextGrammarCard([a], a, true);
    expect(card).toBeNull();
    expect(nextRemaining).toEqual([]);
  });
});
