import { describe, expect, it, vi } from "vitest";
import {
  prepareReviewSession,
  pickNextCard,
  buildTierFn,
  computeAnswerPatch,
  computeRemoveContextPatch,
} from "./studySession";
import type { VocabSettings } from "./vocabSettings";
import { getLearnedTodayCount } from "./vocabSettings";
import { callTTS, callContextsGenerate } from "./api";
import type { Flashcard } from "./flashcards";
import {
  addFlashcard,
  loadFlashcards,
  patchFlashcard,
  pickNextContext,
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
    contextsRefreshedAt: null,
    learningCorrectCount: null,
    relearningStartedAt,
    reviewHistory: [],
  };
}

vi.mock("./api", () => ({
  callTTS: vi.fn(async () => new Blob(["audio"], { type: "audio/mpeg" })),
  callContextsGenerate: vi.fn(async () => ({
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
  textDisplay: `show`,
  includeTranslationInContexts: false,
  avoidAdjacentDuplicates: false,
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

  it("excludes the given card id from the candidate pool when another card is available", () => {
    const cards = [makeCard("just-shown", null), makeCard("other", null)];
    for (let i = 0; i < 50; i++) {
      const picked = pickNextCard(cards, undefined, "just-shown");
      expect(picked?.id).toBe("other");
    }
  });

  it("returns the excluded card anyway when it's the only one left in the tier", () => {
    const cards = [makeCard("just-shown", null)];
    const picked = pickNextCard(cards, undefined, "just-shown");
    expect(picked?.id).toBe("just-shown");
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

  it("ranks upcoming < in-progress learning in learn mode when the flag is on", () => {
    const tier = buildTierFn(`learn`, true, true)!;
    const upcomingCard = makeCard("u", null); // learningCorrectCount === null
    const learningCard = { ...makeCard("l", null), learningCorrectCount: 1 };
    expect(tier(upcomingCard)).toBe(0);
    expect(tier(learningCard)).toBe(1);
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
      contextsRefreshedAt: 100,
      ...overrides,
    };
  }

  it("keeps contexts when a learn-mode card does not yet graduate", () => {
    const card = cardWithContexts({ status: "learning", learningCorrectCount: 0 });
    const { patch, graduate } = computeAnswerPatch(card, "learn", true, 1000, true);
    expect(graduate).toBe(false);
    expect(`contexts` in patch).toBe(false);
    expect(`contextsRefreshedAt` in patch).toBe(false);
  });

  it("flips learningCorrectCount from null to 1 on a learn-mode right answer (first time shown)", () => {
    const card = cardWithContexts({ status: "learning", learningCorrectCount: null });
    const { patch, graduate } = computeAnswerPatch(card, "learn", true, 1000, true);
    expect(graduate).toBe(false);
    expect(patch.learningCorrectCount).toBe(1);
  });

  it("flips learningCorrectCount from null to 0 on a learn-mode wrong answer (first time shown)", () => {
    const card = cardWithContexts({ status: "learning", learningCorrectCount: null });
    const { patch } = computeAnswerPatch(card, "learn", false, 1000, true);
    expect(patch.learningCorrectCount).toBe(0);
  });

  it("does not clear contexts when a review-mode card is answered wrong (relearning)", () => {
    const card = cardWithContexts({ status: "scheduled", currentInterval: DAY });
    const { patch } = computeAnswerPatch(card, "review", false, 1000, true);
    // Wrong-on-review keeps status="scheduled" but marks the card immediately due and
    // sets the relearning flag. status doesn't appear in the patch (no change).
    expect(`status` in patch).toBe(false);
    expect(patch.currentInterval).toBe(0);
    expect(patch.relearningStartedAt).toBe(1000);
    expect(`contexts` in patch).toBe(false);
  });

  it("does NOT append to reviewHistory when answering a relearning card (avoids double-counting in per-day stats)", () => {
    const existing = [{ outcome: "incorrect" as const, timestamp: 500, currentInterval: DAY }];
    const card = cardWithContexts({
      status: "scheduled",
      currentInterval: 0,
      relearningStartedAt: 500,
      lastReviewed: 500,
      reviewHistory: existing,
    });
    const { patch: rightPatch } = computeAnswerPatch(card, "review", true, 1000, true);
    expect(rightPatch.reviewHistory).toEqual(existing);

    const { patch: wrongPatch } = computeAnswerPatch(card, "review", false, 1000, true);
    expect(wrongPatch.reviewHistory).toEqual(existing);
  });

  it("graduates a relearning card on a single right answer in review mode, with interval reset to INITIAL_INTERVAL (does NOT re-advance via nextInterval, which would silently undo the wrong's reset)", () => {
    const card = cardWithContexts({
      status: "scheduled",
      currentInterval: 0,
      relearningStartedAt: 500,
      lastReviewed: 500,
    });
    const { patch, graduate } = computeAnswerPatch(card, "review", true, 1000, true);
    expect(graduate).toBe(true);
    expect(patch.status).toBe("scheduled");
    expect(patch.currentInterval).toBe(INITIAL_INTERVAL);
    expect(patch.relearningStartedAt).toBeNull();
  });

  it("advances by INTERVAL_MULTIPLIER (2.5x) when right answer is for a card NOT in relearning", () => {
    const card = cardWithContexts({
      status: "scheduled",
      currentInterval: 3 * DAY,
      relearningStartedAt: null,
    });
    const { patch } = computeAnswerPatch(card, "review", true, 1000, true);
    expect(patch.currentInterval).toBe(Math.round(3 * DAY * 2.5));
    expect(patch.relearningStartedAt).toBeNull();
  });

  it("sets lastReviewed=now on a right-in-review answer so the card derives back to scheduled", () => {
    // This is the active half of the due → scheduled transition: pushing lastReviewed
    // forward so that lastReviewed + currentInterval > now, which flips computeSrsStatus
    // from "due" back to "scheduled". The interval half is covered by the test above.
    const card = cardWithContexts({
      status: "scheduled",
      currentInterval: 3 * DAY,
      relearningStartedAt: null,
      lastReviewed: 500,
    });
    const { patch } = computeAnswerPatch(card, "review", true, 1000, true);
    expect(patch.lastReviewed).toBe(1000);
  });

  it("appends a 'correct' entry to reviewHistory when a review is answered right", () => {
    const card = cardWithContexts({ status: "scheduled", currentInterval: 3 * DAY });
    const { patch } = computeAnswerPatch(card, "review", true, 1000, true);
    expect(patch.reviewHistory).toEqual([
      { outcome: "correct", timestamp: 1000, currentInterval: 3 * DAY },
    ]);
  });

  it("appends an 'incorrect' entry to reviewHistory when a review is answered wrong", () => {
    const card = cardWithContexts({ status: "scheduled", currentInterval: 7 * DAY });
    const { patch } = computeAnswerPatch(card, "review", false, 1000, true);
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
    const { patch } = computeAnswerPatch(card, "review", true, 1000, true);
    expect(patch.reviewHistory).toEqual([
      prior,
      { outcome: "correct", timestamp: 1000, currentInterval: 3 * DAY },
    ]);
  });

  it("does NOT touch reviewHistory when a learn-mode answer is given (relearning practice)", () => {
    const card = cardWithContexts({ status: "learning", learningCorrectCount: 0 });
    const right = computeAnswerPatch(card, "learn", true, 1000, true);
    const wrong = computeAnswerPatch(card, "learn", false, 1000, true);
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
      contextsRefreshedAt: 100,
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
    expect(`contextsRefreshedAt` in patch).toBe(false);
  });

  it("clears contextsRefreshedAt when the removed context was the last one", () => {
    const card = cardWith([{ source: "only", audioKey: null }]);
    const { patch } = computeRemoveContextPatch(card, 0);
    expect(patch.contexts).toEqual([]);
    expect(patch.contextsRefreshedAt).toBeNull();
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

  it("includes relearning cards (so they survive a re-entry into the review session)", async () => {
    const due = (await addFlashcard("Spanish", "manzana", "apple"))!;
    await makeCardDue(due.id);
    const relearning = (await addFlashcard("Spanish", "pera", "pear"))!;
    // Relearning under the new model = scheduled + immediately due + flag set.
    await patchFlashcard(relearning.id, {
      status: "scheduled",
      lastReviewed: Date.now(),
      currentInterval: 0,
      relearningStartedAt: Date.now(),
    });

    const session = await prepareReviewSession("Spanish", settings);

    expect(session).not.toBeNull();
    const ids = session!.cards.map((c) => c.id);
    expect(ids).toContain(due.id);
    expect(ids).toContain(relearning.id);
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

describe("learnedToday counter stays in sync with per-card promotions", () => {
  it("scenario: user clicks Learn, generation completes for some cards, user navigates away before the batch counter update — counter must still reflect the cards that were promoted", async () => {
    // Reproduces the user-observed bug: click "Learn new cards", something breaks, click
    // again, and the second batch promotes a FULL fresh daily quota's worth of cards
    // because the counter never recorded the first batch's promotions.
    //
    // Today the counter increments live in prepareLearnSession AFTER Promise.all resolves
    // — meanwhile generateContextsFor patches each card's status to "learning" as it
    // completes. If anything cuts the function short before the bulk counter increment
    // (browser refresh, navigation, error), promoted cards exist in the DB but the
    // counter never moved. Next page load: UI thinks zero cards have been learned today
    // and offers the full quota again.
    //
    // This test simulates the cut-short scenario by calling generateContextsFor directly
    // (the work the user already paid for) without ever reaching the trailing
    // recordLearnedToday(...) call.
    const c1 = (await addFlashcard("Spanish", "uno", "one"))!;
    const c2 = (await addFlashcard("Spanish", "dos", "two"))!;

    await generateContextsFor(c1, settings);
    await generateContextsFor(c2, settings);

    const cards = await loadFlashcards("Spanish");
    const promoted = cards.filter((c) => c.status === "learning").length;
    expect(promoted).toBe(2);

    const counter = await getLearnedTodayCount();
    expect(counter).toBe(2);
  });
});

describe("graduation preserves contexts so unseen ones can be reused", () => {
  // Bug 1: the old code wiped `contexts: []` on graduation. That defeated the whole
  // seen/unseen savings — by the time regen ran, there was nothing left to keep.
  it("a card with unseen contexts retains all of them after graduation", async () => {
    vi.mocked(callContextsGenerate).mockReset();
    vi.mocked(callContextsGenerate).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              contexts: [
                { source: `ctx-a`, translation: `A` },
                { source: `ctx-b`, translation: `B` },
                { source: `ctx-c`, translation: `C` },
              ],
            }),
          },
        },
      ],
    });

    const card = (await addFlashcard(`Spanish`, `lluvia`, `rain`))!;
    await generateContextsFor(card, settings);

    let stored = (await loadFlashcards(`Spanish`)).find((c) => c.id === card.id)!;
    await pickNextContext(stored); // user sees 1 context
    stored = (await loadFlashcards(`Spanish`)).find((c) => c.id === card.id)!;

    // Two correct answers in learn mode graduate the card.
    let result = computeAnswerPatch(stored, `learn`, true, Date.now(), true);
    await patchFlashcard(stored.id, result.patch);
    stored = (await loadFlashcards(`Spanish`)).find((c) => c.id === card.id)!;
    result = computeAnswerPatch(stored, `learn`, true, Date.now(), true);
    expect(result.graduate).toBe(true);
    await patchFlashcard(stored.id, result.patch);

    const finalCard = (await loadFlashcards(`Spanish`)).find((c) => c.id === card.id)!;
    expect(finalCard.contexts.length).toBe(3);
    expect(finalCard.contexts.filter((c) => c.seen).length).toBe(1);
    expect(finalCard.contextsRefreshedAt).toBeNull(); // still flagged for top-up
  });
});

describe("session-prep triggers regeneration via the contextsRefreshedAt flag", () => {
  // Bug 2: once we stopped wiping contexts on graduation (bug 1 fix), the old filter
  // `contexts.length === 0` no longer picked up the card — graduated cards now hold
  // unseen contexts, so the array isn't empty. The filter must key on the regen flag.
  it("prepares regeneration for a card whose contextsRefreshedAt is null even when contexts are non-empty", async () => {
    vi.mocked(callContextsGenerate).mockReset();
    vi.mocked(callContextsGenerate).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              contexts: [{ source: `ctx-fresh`, translation: `Fresh` }],
            }),
          },
        },
      ],
    });

    const card = (await addFlashcard(`Spanish`, `nube`, `cloud`))!;
    await updateFlashcardContexts(
      card.id,
      [
        { source: `kept-a`, translation: `KA`, audioKey: null },
        { source: `kept-b`, translation: `KB`, audioKey: null },
      ],
      null, // contextsRefreshedAt null = needs regen, even though contexts exist
    );
    await makeCardDue(card.id);

    await prepareReviewSession(`Spanish`, { ...settings, generateAudio: false });

    expect(vi.mocked(callContextsGenerate).mock.calls.length).toBe(1);
    const finalCard = (await loadFlashcards(`Spanish`)).find((c) => c.id === card.id)!;
    expect(finalCard.contexts.length).toBe(3);
    expect(finalCard.contextsRefreshedAt).not.toBeNull();
  });
});
