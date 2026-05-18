import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  addFlashcard,
  computeStatus,
  patchFlashcard,
  updateFlashcardContexts,
  loadFlashcards,
  pickNextContext,
} from "./flashcards";
import { DAY, INITIAL_INTERVAL } from "./studySession";
import { generateContextsFor, addMissingAudioFor } from "./contextOrchestrator";
import { callTTS, callContexts } from "./api";
import type { VocabSettings } from "./vocabSettings";

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

globalThis.URL.createObjectURL = vi.fn((blob: Blob) => `blob:fake/${blob.size}`);
globalThis.URL.revokeObjectURL = vi.fn();

const settings: VocabSettings = {
  newWordsPerDay: 5,
  contextsPerCard: 1,
  order: "random",
  generateAudio: true,
  autoplayAudio: false,
  showText: true,
};

beforeEach(() => {
  localStorage.clear();
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

describe("addFlashcard", () => {
  it("creates a card with status 'new'", () => {
    const card = addFlashcard("Spanish", "hola", "hello");
    expect(card).not.toBeNull();
    expect(card!.status).toBe("new");
    expect(card!.lastReviewed).toBeNull();
    expect(card!.currentInterval).toBe(0);
  });

  it("returns null for a duplicate source (case-insensitive)", () => {
    addFlashcard("Spanish", "hola", "hello");
    expect(addFlashcard("Spanish", "HOLA", "hello")).toBeNull();
  });
});

describe("computeStatus", () => {
  it("returns 'new' for a card with status 'new'", () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    expect(computeStatus(card)).toBe("new");
  });

  it("returns 'learning' for a card with status 'learning'", () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    patchFlashcard(card.id, { status: "learning" });
    const [updated] = loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("learning");
  });

  it("returns 'scheduled' for a card with a future interval", () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    patchFlashcard(card.id, {
      status: "scheduled",
      lastReviewed: Date.now(),
      currentInterval: 7 * DAY,
    });
    const [updated] = loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("scheduled");
  });

  it("returns 'due' for a scheduled card past its interval", () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    patchFlashcard(card.id, {
      status: "scheduled",
      lastReviewed: Date.now() - 2 * DAY,
      currentInterval: INITIAL_INTERVAL,
    });
    const [updated] = loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("due");
  });

  it("returns 'dropped' for a dropped card", () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    patchFlashcard(card.id, { status: "dropped" });
    const [updated] = loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("dropped");
  });

  it("returns 'relearning' for a learning card with relearningStartedAt set", () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    patchFlashcard(card.id, {
      status: "learning",
      relearningStartedAt: Date.now(),
    });
    const [updated] = loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("relearning");
  });

  it("returns 'learning' (not relearning) when relearningStartedAt is null", () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    patchFlashcard(card.id, { status: "learning", relearningStartedAt: null });
    const [updated] = loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("learning");
  });
});

describe("generateContextsFor", () => {
  it("generates contexts and stores them", async () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    await generateContextsFor(card, settings);

    const [updated] = loadFlashcards("Spanish");
    expect(updated.contexts.length).toBeGreaterThan(0);
    expect(updated.dateContextGenerated).not.toBeNull();
  });

  it("skips TTS and leaves audioKey null when generateAudio is false", async () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    await generateContextsFor(card, { ...settings, generateAudio: false });

    const [updated] = loadFlashcards("Spanish");
    expect(updated.contexts.every((c) => c.audioKey === null)).toBe(true);
  });

  it("stores audio keys when generateAudio is true", async () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    await generateContextsFor(card, settings);

    const [updated] = loadFlashcards("Spanish");
    expect(updated.contexts.every((c) => c.audioKey !== null)).toBe(true);
  });

  it("strips ** markers from text before sending to TTS", async () => {
    vi.mocked(callTTS).mockClear();
    vi.mocked(callContexts).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              contexts: [
                { source: "El gato **se esconde** aquí", translation: "The cat hides here" },
              ],
            }),
          },
        },
      ],
    });
    const card = addFlashcard("Spanish", "esconder", "to hide")!;
    await generateContextsFor(card, settings);

    expect(callTTS).toHaveBeenCalled();
    const ttsInput = vi.mocked(callTTS).mock.calls[0][0].input;
    expect(ttsInput).not.toContain("**");
    expect(ttsInput).toBe("El gato se esconde aquí");

    // The stored context still keeps the ** so the UI can render bold
    const [updated] = loadFlashcards("Spanish");
    expect(updated.contexts[0].source).toBe("El gato **se esconde** aquí");
  });
});

describe("addMissingAudioFor", () => {
  it("strips ** markers from text before sending to TTS", async () => {
    vi.mocked(callTTS).mockClear();
    const card = addFlashcard("Spanish", "esconder", "to hide")!;
    updateFlashcardContexts(
      card.id,
      [
        {
          source: "El gato **se esconde** aquí",
          translation: "The cat hides here",
          audioKey: null,
        },
      ],
      Date.now(),
    );
    const [stored] = loadFlashcards("Spanish");

    await addMissingAudioFor(stored, settings);

    expect(callTTS).toHaveBeenCalledTimes(1);
    const ttsInput = vi.mocked(callTTS).mock.calls[0][0].input;
    expect(ttsInput).not.toContain("**");
    expect(ttsInput).toBe("El gato se esconde aquí");
  });
});

describe("pickNextContext", () => {
  function withContexts(cursor: number | undefined, n: number) {
    const card = addFlashcard("Spanish", `w${Math.random()}`, "x")!;
    const ctxs = Array.from({ length: n }, (_, i) => ({
      source: `s${i}`,
      translation: `t${i}`,
      audioKey: null,
    }));
    updateFlashcardContexts(card.id, ctxs, Date.now());
    if (cursor !== undefined) patchFlashcard(card.id, { contextCursor: cursor });
    return loadFlashcards("Spanish").find((c) => c.id === card.id)!;
  }

  it("returns 0 when contextCursor is undefined (brand-new card)", () => {
    expect(pickNextContext(withContexts(undefined, 3))).toBe(0);
  });

  it("returns the stored cursor when within bounds", () => {
    expect(pickNextContext(withContexts(1, 3))).toBe(1);
    expect(pickNextContext(withContexts(2, 3))).toBe(2);
  });

  it("wraps via modulo when the stored cursor exceeds contexts length (e.g. after regen)", () => {
    expect(pickNextContext(withContexts(5, 3))).toBe(2);
  });

  it("returns 0 safely when the card has no contexts", () => {
    expect(pickNextContext(withContexts(undefined, 0))).toBe(0);
  });

  it("cycles through distinct indices on consecutive calls with the same in-memory card", () => {
    const card = withContexts(undefined, 3);
    expect(pickNextContext(card)).toBe(0);
    expect(pickNextContext(card)).toBe(1);
    expect(pickNextContext(card)).toBe(2);
    expect(pickNextContext(card)).toBe(0);
  });
});

describe("updateFlashcardContexts", () => {
  it("replaces contexts and updates dateContextGenerated", () => {
    const card = addFlashcard("Spanish", "hola", "hello")!;
    const now = Date.now();
    updateFlashcardContexts(
      card.id,
      [{ source: "Hola mundo", translation: "Hello world", audioKey: null }],
      now,
    );

    const [updated] = loadFlashcards("Spanish");
    expect(updated.contexts).toHaveLength(1);
    expect(updated.contexts[0].source).toBe("Hola mundo");
    expect(updated.dateContextGenerated).toBe(now);
  });
});
