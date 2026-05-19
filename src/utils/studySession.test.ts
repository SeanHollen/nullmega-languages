import { describe, expect, it, vi } from "vitest";
import {
  prepareReviewSession,
  pickNextCard,
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
    learningCorrectCount: 0,
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
};

async function makeCardDue(id: string): Promise<void> {
  await patchFlashcard(id, {
    status: "scheduled",
    lastReviewed: Date.now() - 2 * DAY,
    currentInterval: INITIAL_INTERVAL,
  });
}

describe("pickNextCard", () => {
  it("returns null for an empty list", () => {
    expect(pickNextCard([])).toBeNull();
  });

  it("always returns a non-relearning card when both kinds are present", () => {
    const cards = [
      makeCard("a", Date.now()),
      makeCard("b", null),
      makeCard("c", Date.now()),
      makeCard("d", Date.now()),
    ];
    for (let i = 0; i < 50; i++) {
      const picked = pickNextCard(cards);
      expect(picked?.id).toBe("b");
    }
  });

  it("falls back to a relearning card when nothing else is left", () => {
    const cards = [makeCard("a", 100), makeCard("b", 200)];
    const picked = pickNextCard(cards);
    expect(picked).not.toBeNull();
    expect(picked!.relearningStartedAt).not.toBeNull();
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
