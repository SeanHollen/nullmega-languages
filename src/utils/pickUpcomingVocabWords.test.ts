import { describe, expect, it } from "vitest";
import { pickUpcomingVocabWords } from "./pickUpcomingVocabWords";
import type { Flashcard } from "./flashcards";

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1_700_000_000_000;

function makeCard(id: string, dueInDays: number, status: Flashcard["status"]): Flashcard {
  return {
    id,
    source: id,
    translation: `${id}-en`,
    language: "French",
    addedAt: NOW - 7 * DAY,
    lastReviewed: NOW - DAY,
    currentInterval: (dueInDays + 1) * DAY,
    tags: [],
    status,
    contexts: [],
    contextsRefreshedAt: null,
    learningCorrectCount: null,
    relearningStartedAt: null,
    reviewHistory: [],
  };
}

// Mulberry32: a tiny deterministic RNG so the tests are stable.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("pickUpcomingVocabWords", () => {
  it("returns [] when there are no scheduled cards", () => {
    const cards = [makeCard("a", 1, "new"), makeCard("b", 1, "learning")];
    expect(pickUpcomingVocabWords(cards, rng(1), NOW)).toEqual([]);
  });

  it("returns all cards when fewer than the minimum target are available", () => {
    const cards = [
      makeCard("a", 1, "scheduled"),
      makeCard("b", 2, "scheduled"),
      makeCard("c", 3, "scheduled"),
    ];
    const picked = pickUpcomingVocabWords(cards, rng(1), NOW);
    expect(picked.map((c) => c.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("heavily biases toward soon-due cards but does not strictly exclude later ones", () => {
    // 10 cards due tomorrow + 10 due in a week. Plenty of soon-due cards to satisfy
    // the target (5–8) without needing later ones; the bias should make soon-picks
    // dominate, but with enough trials we expect at least *some* later picks.
    const cards = [
      ...Array.from({ length: 10 }, (_, i) => makeCard(`soon-${i}`, 1, "scheduled")),
      ...Array.from({ length: 10 }, (_, i) => makeCard(`later-${i}`, 7, "scheduled")),
    ];
    let soonPicks = 0;
    let laterPicks = 0;
    const trials = 200;
    for (let t = 0; t < trials; t++) {
      const picked = pickUpcomingVocabWords(cards, rng(t + 1), NOW);
      for (const card of picked) {
        if (card.id.startsWith("soon")) soonPicks++;
        else laterPicks++;
      }
    }
    expect(soonPicks).toBeGreaterThan(laterPicks * 5); // strong bias
    expect(laterPicks).toBeGreaterThan(0); // but not zero
  });

  it("does not always pick the exact same 5 words when many cards have near-equal due times", () => {
    // 12 cards all due ~tomorrow, with sub-second separation. The old strict-sort
    // picker would deterministically return the first 5; the weighted picker should
    // exhibit clear variability across runs.
    const cards = Array.from({ length: 12 }, (_, i) => {
      const c = makeCard(`c-${i}`, 1, "scheduled");
      c.currentInterval += i * 1000; // 1s apart
      return c;
    });
    const seen = new Set<string>();
    for (let t = 0; t < 50; t++) {
      const picked = pickUpcomingVocabWords(cards, rng(t + 1), NOW);
      seen.add(
        picked
          .map((c) => c.id)
          .sort()
          .join(","),
      );
    }
    // 50 trials should produce many distinct selections, not just one.
    expect(seen.size).toBeGreaterThan(10);
  });
});
