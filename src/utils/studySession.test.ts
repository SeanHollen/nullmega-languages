import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
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

function makeCardDue(id: string): void {
  patchFlashcard(id, {
    status: "scheduled",
    lastReviewed: Date.now() - 2 * DAY,
    currentInterval: INITIAL_INTERVAL,
  });
}

beforeEach(() => {
  localStorage.clear();
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

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
    const card = addFlashcard("Spanish", "hola", "hello")!;
    updateFlashcardContexts(
      card.id,
      [{ source: "Hola, ¿cómo estás?", translation: "Hello, how are you?", audioKey: null }],
      Date.now(),
    );
    makeCardDue(card.id);

    const session = await prepareReviewSession("Spanish", settings);

    expect(session).not.toBeNull();
    const finalCard = session!.cards.find((c) => c.id === card.id);
    expect(finalCard).toBeDefined();
    expect(finalCard!.contexts[0].audioKey).not.toBeNull();
    expect(session!.audioUrl).toMatch(/^blob:/);
  });

  it("adds audio when generateAudio was off during context generation but on during review", async () => {
    // Simulate: user had generateAudio off, contexts were regenerated (no audio stored),
    // then user turns generateAudio on and starts a review session.
    const card = addFlashcard("Spanish", "gracias", "thank you")!;
    makeCardDue(card.id);
    const dueCard = loadFlashcards("Spanish").find((c) => c.id === card.id)!;

    await generateContextsFor(dueCard, { ...settings, generateAudio: false });

    // Confirm contexts exist but have no audio
    const [stored] = loadFlashcards("Spanish").filter((c) => c.id === card.id);
    expect(stored.contexts.length).toBeGreaterThan(0);
    expect(stored.contexts.every((ctx) => ctx.audioKey === null)).toBe(true);

    // Now review with generateAudio on — should fill in the missing audio
    const session = await prepareReviewSession("Spanish", settings);

    expect(session).not.toBeNull();
    const finalCard = session!.cards.find((c) => c.id === card.id);
    expect(finalCard).toBeDefined();
    expect(finalCard!.contexts.every((ctx) => ctx.audioKey !== null)).toBe(true);
    expect(session!.audioUrl).toMatch(/^blob:/);
  });

  it("does not call TTS when generateAudio is false", async () => {
    vi.mocked(callTTS).mockClear();

    const card = addFlashcard("Spanish", "adios", "goodbye")!;
    updateFlashcardContexts(
      card.id,
      [{ source: "Adiós, hasta luego.", translation: "Goodbye, see you later.", audioKey: null }],
      Date.now(),
    );
    makeCardDue(card.id);

    await prepareReviewSession("Spanish", { ...settings, generateAudio: false });

    expect(callTTS).not.toHaveBeenCalled();
  });
});
