import { describe, expect, it, vi } from "vitest";
import {
  prepareReviewSession,
  pickNextCard,
  buildTierFn,
  computeAnswerPatch,
  computeRemoveContextPatch,
} from "./studySession";
import type { VocabSettings } from "./vocabSettings";
import { callTTS } from "./api";
import type { Flashcard } from "./flashcards";
import {
  addFlashcard,
  loadFlashcards,
  patchFlashcard,
  updateFlashcardContexts,
} from "./flashcards";
import { DAY, INITIAL_INTERVAL } from "./studySession";
import { generateContextsFor } from "./contextOrchestrator";

function makeCard(id: string, relearningStartedAt: number | null): Flashcard {
  return {
    id,
    source: id,
    translation: id,
    language: "Spanish",
    addedAt: 0,
    lastReviewed: null,
    currentInterval: 0,
    tags: [],
    status: "learning",
    contexts: [],
    dateContextGenerated: null,
    learningCorrectCount: null,
    relearningStartedAt,
    reviewHistory: [],
  };
}

vi.mock("./api", () => ({
  callTTS: vi.fn(async () => new Blob(["audio"], { type: "audio/mpeg" })),
  callContexts: vi.fn(async () => ({
    choices: [
      {
        message: {
          content: JSON.stringify({
            contexts: [{ source: "Hola, ¿cómo estás?", translation: "Hello, how are you?" }],
          }),
        },
      },
    ],
  })),
}));

// jsdom doesn't implement URL.createObjectURL
globalThis.URL.createObjectURL = vi.fn((blob: Blob) => `blob:fake/${blob.size}`);
globalThis.URL.revokeObjectURL = vi.fn();

const settings: VocabSettings = {
  newWordsPerDay: 5,
  contextsPerCard: 3,
  order: "random",
  generateAudio: true,
  autoplayAudio: false,
  showText: true,
  showUpcomingBeforeLearning: true,
  showDueBeforeRelearning: true,
};

async function makeCardDue(id: string): Promise<void> {
  await patchFlashcard(id, {
    status: "scheduled",
    lastReviewed: Date.now() - 2 * DAY,
    currentInterval: INITIAL_INTERVAL,
  });
}

describe("pickNextCard", () => {
  const reviewTier = buildTierFn(`review`, true, true);

  it("returns null for an empty list", () => {
    expect(pickNextCard([], reviewTier)).toBeNull();
  });

  it("with a tier function, always returns the highest-priority card available", () => {
    const cards = [
      makeCard("a", Date.now()),
      makeCard("b", null),
      makeCard("c", Date.now()),
      makeCard("d", Date.now()),
    ];
    for (let i = 0; i < 50; i++) {
      const picked = pickNextCard(cards, reviewTier);
      expect(picked?.id).toBe("b");
    }
  });

  it("falls back to a lower-priority tier when the top tier is empty", () => {
    const cards = [makeCard("a", 100), makeCard("b", 200)];
    const picked = pickNextCard(cards, reviewTier);
    expect(picked).not.toBeNull();
    expect(picked!.relearningStartedAt).not.toBeNull();
  });

  it("with no tier function, picks uniformly at random across all cards", () => {
    const cards = [makeCard("relearning", Date.now()), makeCard("learning", null)];
    const counts: Record<string, number> = { relearning: 0, learning: 0 };
    for (let i = 0; i < 200; i++) {
      const picked = pickNextCard(cards, undefined);
      counts[picked!.id]++;
    }
    // Both cards should be picked sometimes — neither stays at 0.
    expect(counts.relearning).toBeGreaterThan(0);
    expect(counts.learning).toBeGreaterThan(0);
  });
});

describe("buildTierFn", () => {
  it("returns undefined for learn mode when showUpcomingBeforeLearning is off", () => {
    expect(buildTierFn(`learn`, false, true)).toBeUndefined();
  });

  it("returns undefined for review mode when showDueBeforeRelearning is off", () => {
    expect(buildTierFn(`review`, true, false)).toBeUndefined();
  });

  it("ranks upcoming < learning < relearning in learn mode when the flag is on", () => {
    const tier = buildTierFn(`learn`, true, true)!;
    const upcomingCard = makeCard("u", null); // learningCorrectCount === null
    const learningCard = { ...makeCard("l", null), learningCorrectCount: 1 };
    const relearningCard = makeCard("r", Date.now());
    expect(tier(upcomingCard)).toBe(0);
    expect(tier(learningCard)).toBe(1);
    expect(tier(relearningCard)).toBe(2);
  });

  it("ranks non-relearning < relearning in review mode when the flag is on", () => {
    const tier = buildTierFn(`review`, true, true)!;
    expect(tier(makeCard("a", null))).toBe(0);
    expect(tier(makeCard("b", Date.now()))).toBe(1);
  });
});

describe("computeAnswerPatch", () => {
  function cardWithContexts(overrides: Partial<Flashcard> = {}): Flashcard {
    return {
      ...makeCard("c1", null),
      contexts: [{ source: "src", translation: "tr", audioKey: null }],
      dateContextGenerated: 100,
      ...overrides,
    };
  }

  it("clears contexts when a learn-mode card graduates (count reaches threshold)", () => {
    const card = cardWithContexts({ status: "learning", learningCorrectCount: 1 });
    const { patch, graduate } = computeAnswerPatch(card, "learn", true, 1000);
    expect(graduate).toBe(true);
    expect(patch.status).toBe("scheduled");
    expect(patch.contexts).toEqual([]);
    expect(patch.dateContextGenerated).toBeNull();
  });

  it("keeps contexts when a learn-mode card does not yet graduate", () => {
    const card = cardWithContexts({ status: "learning", learningCorrectCount: 0 });
    const { patch, graduate } = computeAnswerPatch(card, "learn", true, 1000);
    expect(graduate).toBe(false);
    expect(`contexts` in patch).toBe(false);
    expect(`dateContextGenerated` in patch).toBe(false);
  });

  it("flips learningCorrectCount from null to 1 on a learn-mode right answer (first time shown)", () => {
    const card = cardWithContexts({ status: "learning", learningCorrectCount: null });
    const { patch, graduate } = computeAnswerPatch(card, "learn", true, 1000);
    expect(graduate).toBe(false);
    expect(patch.learningCorrectCount).toBe(1);
  });

  it("flips learningCorrectCount from null to 0 on a learn-mode wrong answer (first time shown)", () => {
    const card = cardWithContexts({ status: "learning", learningCorrectCount: null });
    const { patch } = computeAnswerPatch(card, "learn", false, 1000);
    expect(patch.learningCorrectCount).toBe(0);
  });

  it("clears contexts when a review-mode card is answered right", () => {
    const card = cardWithContexts({ status: "scheduled", currentInterval: DAY });
    const { patch } = computeAnswerPatch(card, "review", true, 1000);
    expect(patch.contexts).toEqual([]);
    expect(patch.dateContextGenerated).toBeNull();
  });

  it("does not clear contexts when a review-mode card is answered wrong (relearning)", () => {
    const card = cardWithContexts({ status: "scheduled", currentInterval: DAY });
    const { patch } = computeAnswerPatch(card, "review", false, 1000);
    expect(patch.status).toBe("learning");
    expect(patch.relearningStartedAt).toBe(1000);
    expect(`contexts` in patch).toBe(false);
  });

  it("graduates a relearning card on a single right answer in review mode, but keeps interval at INITIAL_INTERVAL (does NOT re-advance via nextInterval, which would silently undo the wrong's reset)", () => {
    const card = cardWithContexts({
      status: "learning",
      currentInterval: INITIAL_INTERVAL,
      relearningStartedAt: 500,
      learningCorrectCount: 0,
    });
    const { patch, graduate } = computeAnswerPatch(card, "review", true, 1000);
    expect(graduate).toBe(true);
    expect(patch.status).toBe("scheduled");
    expect(patch.currentInterval).toBe(INITIAL_INTERVAL);
    expect(patch.relearningStartedAt).toBeNull();
  });

  it("advances via nextInterval when right answer is for a card NOT in relearning", () => {
    const card = cardWithContexts({
      status: "scheduled",
      currentInterval: 3 * DAY,
      relearningStartedAt: null,
    });
    const { patch } = computeAnswerPatch(card, "review", true, 1000);
    expect(patch.currentInterval).toBe(7 * DAY);
    expect(patch.relearningStartedAt).toBeNull();
  });

  it("appends a 'correct' entry to reviewHistory when a review is answered right", () => {
    const card = cardWithContexts({ status: "scheduled", currentInterval: 3 * DAY });
    const { patch } = computeAnswerPatch(card, "review", true, 1000);
    expect(patch.reviewHistory).toEqual([
      { outcome: "correct", timestamp: 1000, currentInterval: 3 * DAY },
    ]);
  });

  it("appends an 'incorrect' entry to reviewHistory when a review is answered wrong", () => {
    const card = cardWithContexts({ status: "scheduled", currentInterval: 7 * DAY });
    const { patch } = computeAnswerPatch(card, "review", false, 1000);
    expect(patch.reviewHistory).toEqual([
      { outcome: "incorrect", timestamp: 1000, currentInterval: 7 * DAY },
    ]);
  });

  it("preserves prior reviewHistory entries when appending a new one", () => {
    const prior = { outcome: "correct" as const, timestamp: 500, currentInterval: DAY };
    const card = cardWithContexts({
      status: "scheduled",
      currentInterval: 3 * DAY,
      reviewHistory: [prior],
    });
    const { patch } = computeAnswerPatch(card, "review", true, 1000);
    expect(patch.reviewHistory).toEqual([
      prior,
      { outcome: "correct", timestamp: 1000, currentInterval: 3 * DAY },
    ]);
  });

  it("does NOT touch reviewHistory when a learn-mode answer is given (relearning practice)", () => {
    const card = cardWithContexts({ status: "learning", learningCorrectCount: 0 });
    const right = computeAnswerPatch(card, "learn", true, 1000);
    const wrong = computeAnswerPatch(card, "learn", false, 1000);
    expect(`reviewHistory` in right.patch).toBe(false);
    expect(`reviewHistory` in wrong.patch).toBe(false);
  });
});

describe("computeRemoveContextPatch", () => {
  function cardWith(contexts: { source: string; audioKey: string | null }[]): Flashcard {
    return {
      ...makeCard("c1", null),
      contexts: contexts.map((c) => ({
        source: c.source,
        translation: "tr",
        audioKey: c.audioKey,
      })),
      dateContextGenerated: 100,
    };
  }

  it("returns the contexts array with the target index removed", () => {
    const card = cardWith([
      { source: "a", audioKey: null },
      { source: "b", audioKey: null },
      { source: "c", audioKey: null },
    ]);
    const { patch } = computeRemoveContextPatch(card, 1);
    expect(patch.contexts).toEqual([
      { source: "a", translation: "tr", audioKey: null },
      { source: "c", translation: "tr", audioKey: null },
    ]);
    expect(`dateContextGenerated` in patch).toBe(false);
  });

  it("clears dateContextGenerated when the removed context was the last one", () => {
    const card = cardWith([{ source: "only", audioKey: null }]);
    const { patch } = computeRemoveContextPatch(card, 0);
    expect(patch.contexts).toEqual([]);
    expect(patch.dateContextGenerated).toBeNull();
  });

  it("surfaces the removed context's audioKey so the caller can clean up the blob", () => {
    const card = cardWith([
      { source: "a", audioKey: "audio-a" },
      { source: "b", audioKey: "audio-b" },
    ]);
    const { removedAudioKey } = computeRemoveContextPatch(card, 0);
    expect(removedAudioKey).toBe("audio-a");
  });

  it("returns a null audioKey when the removed context had no audio", () => {
    const card = cardWith([{ source: "a", audioKey: null }]);
    const { removedAudioKey } = computeRemoveContextPatch(card, 0);
    expect(removedAudioKey).toBeNull();
  });
});

describe("prepareReviewSession", () => {
  it("fills in missing audio for cards with contexts but no audioKey", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await updateFlashcardContexts(
      card.id,
      [{ source: "Hola, ¿cómo estás?", translation: "Hello, how are you?", audioKey: null }],
      Date.now(),
    );
    await makeCardDue(card.id);

    const session = await prepareReviewSession("Spanish", settings);

    expect(session).not.toBeNull();
    const finalCard = session!.cards.find((c) => c.id === card.id);
    expect(finalCard).toBeDefined();
    expect(finalCard!.contexts[0].audioKey).not.toBeNull();
    expect(session!.audioUrl).toMatch(/^blob:/);
  });

  it("adds audio when generateAudio was off during context generation but on during review", async () => {
    const card = (await addFlashcard("Spanish", "gracias", "thank you"))!;
    await makeCardDue(card.id);
    const dueCard = (await loadFlashcards("Spanish")).find((c) => c.id === card.id)!;

    await generateContextsFor(dueCard, { ...settings, generateAudio: false });

    const stored = (await loadFlashcards("Spanish")).find((c) => c.id === card.id)!;
    expect(stored.contexts.length).toBeGreaterThan(0);
    expect(stored.contexts.every((ctx) => ctx.audioKey === null)).toBe(true);

    const session = await prepareReviewSession("Spanish", settings);

    expect(session).not.toBeNull();
    const finalCard = session!.cards.find((c) => c.id === card.id);
    expect(finalCard).toBeDefined();
    expect(finalCard!.contexts.every((ctx) => ctx.audioKey !== null)).toBe(true);
    expect(session!.audioUrl).toMatch(/^blob:/);
  });

  it("does not call TTS when generateAudio is false", async () => {
    vi.mocked(callTTS).mockClear();

    const card = (await addFlashcard("Spanish", "adios", "goodbye"))!;
    await updateFlashcardContexts(
      card.id,
      [{ source: "Adiós, hasta luego.", translation: "Goodbye, see you later.", audioKey: null }],
      Date.now(),
    );
    await makeCardDue(card.id);

    await prepareReviewSession("Spanish", { ...settings, generateAudio: false });

    expect(callTTS).not.toHaveBeenCalled();
  });
});
