import { describe, expect, it, vi } from "vitest";
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
import { callTTS, callContextsGenerate } from "./api";
import type { VocabSettings } from "./vocabSettings";

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

globalThis.URL.createObjectURL = vi.fn((blob: Blob) => `blob:fake/${blob.size}`);
globalThis.URL.revokeObjectURL = vi.fn();

const settings: VocabSettings = {
  newWordsPerDay: 5,
  contextsPerCard: 1,
  order: "random",
  generateAudio: true,
  autoplayAudio: false,
  textDisplay: `show`,
  includeTranslationInContexts: false,
  avoidAdjacentDuplicates: false,
};

describe("addFlashcard", () => {
  it("creates a card with status 'new'", async () => {
    const card = await addFlashcard("Spanish", "hola", "hello");
    expect(card).not.toBeNull();
    expect(card!.status).toBe("new");
    expect(card!.lastReviewed).toBeNull();
    expect(card!.currentInterval).toBe(0);
  });

  it("returns null for a duplicate source (case-insensitive)", async () => {
    await addFlashcard("Spanish", "hola", "hello");
    expect(await addFlashcard("Spanish", "HOLA", "hello")).toBeNull();
  });
});

describe("computeStatus", () => {
  it("returns 'new' for a card with status 'new'", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    expect(computeStatus(card)).toBe("new");
  });

  it("returns 'learning' for a card with status 'learning'", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await patchFlashcard(card.id, { status: "learning" });
    const [updated] = await loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("learning");
  });

  it("returns 'scheduled' for a card with a future interval", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await patchFlashcard(card.id, {
      status: "scheduled",
      lastReviewed: Date.now(),
      currentInterval: 7 * DAY,
    });
    const [updated] = await loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("scheduled");
  });

  it("returns 'due' for a scheduled card past its interval", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await patchFlashcard(card.id, {
      status: "scheduled",
      lastReviewed: Date.now() - 2 * DAY,
      currentInterval: INITIAL_INTERVAL,
    });
    const [updated] = await loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("due");
  });

  it("returns 'dropped' for a dropped card", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await patchFlashcard(card.id, { status: "dropped" });
    const [updated] = await loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("dropped");
  });

  it("returns 'relearning' for a due card with relearningStartedAt set", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await patchFlashcard(card.id, {
      status: "scheduled",
      lastReviewed: Date.now() - 2 * DAY,
      currentInterval: INITIAL_INTERVAL,
      relearningStartedAt: Date.now(),
    });
    const [updated] = await loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("relearning");
  });

  it("returns 'learning' (never 'relearning') for status=learning regardless of the flag", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await patchFlashcard(card.id, { status: "learning", relearningStartedAt: Date.now() });
    const [updated] = await loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("learning");
  });

  it("returns 'learning' when relearningStartedAt is null", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await patchFlashcard(card.id, { status: "learning", relearningStartedAt: null });
    const [updated] = await loadFlashcards("Spanish");
    expect(computeStatus(updated)).toBe("learning");
  });
});

describe("generateContextsFor", () => {
  it("generates contexts and stores them", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await generateContextsFor(card, settings);

    const [updated] = await loadFlashcards("Spanish");
    expect(updated.contexts.length).toBeGreaterThan(0);
    expect(updated.contextsRefreshedAt).not.toBeNull();
  });

  it("skips TTS and leaves audioKey null when generateAudio is false", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await generateContextsFor(card, { ...settings, generateAudio: false });

    const [updated] = await loadFlashcards("Spanish");
    expect(updated.contexts.every((c) => c.audioKey === null)).toBe(true);
  });

  it("stores audio keys when generateAudio is true", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    await generateContextsFor(card, settings);

    const [updated] = await loadFlashcards("Spanish");
    expect(updated.contexts.every((c) => c.audioKey !== null)).toBe(true);
  });

  it("strips ** markers from text before sending to TTS", async () => {
    vi.mocked(callTTS).mockClear();
    vi.mocked(callContextsGenerate).mockResolvedValueOnce({
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
    const card = (await addFlashcard("Spanish", "esconder", "to hide"))!;
    await generateContextsFor(card, settings);

    expect(callTTS).toHaveBeenCalled();
    const ttsInput = vi.mocked(callTTS).mock.calls[0][0].input;
    expect(ttsInput).not.toContain("**");
    expect(ttsInput).toBe("El gato se esconde aquí");

    // The stored context still keeps the ** so the UI can render bold
    const [updated] = await loadFlashcards("Spanish");
    expect(updated.contexts[0].source).toBe("El gato **se esconde** aquí");
  });

  it("keeps unseen contexts and only generates the shortfall on regeneration", async () => {
    const card = (await addFlashcard("Spanish", "lluvia", "rain"))!;
    await updateFlashcardContexts(
      card.id,
      [
        { source: "ctx-seen", translation: "ctx-seen-en", audioKey: "audio-seen", seen: true },
        { source: "ctx-unseen", translation: "ctx-unseen-en", audioKey: "audio-unseen" },
      ],
      Date.now(),
    );
    vi.mocked(callContextsGenerate).mockClear();
    vi.mocked(callContextsGenerate).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              contexts: [{ source: "ctx-new", translation: "ctx-new-en" }],
            }),
          },
        },
      ],
    });
    const [stored] = await loadFlashcards("Spanish");
    await generateContextsFor(stored, { ...settings, contextsPerCard: 2, generateAudio: false });

    expect(callContextsGenerate).toHaveBeenCalledTimes(1);
    const [updated] = await loadFlashcards("Spanish");
    expect(updated.contexts.map((c) => c.source)).toEqual(["ctx-unseen", "ctx-new"]);
    expect(updated.contexts[0].audioKey).toBe("audio-unseen"); // kept context retains its audio
    expect(updated.contextCursor).toBe(0);
  });

  it("skips generation entirely when all contexts are still unseen", async () => {
    const card = (await addFlashcard("Spanish", "nube", "cloud"))!;
    await updateFlashcardContexts(
      card.id,
      [
        { source: "ctx-a", translation: "a", audioKey: null },
        { source: "ctx-b", translation: "b", audioKey: null },
      ],
      Date.now(),
    );
    vi.mocked(callContextsGenerate).mockClear();
    const [stored] = await loadFlashcards("Spanish");
    await generateContextsFor(stored, { ...settings, contextsPerCard: 2, generateAudio: false });

    expect(callContextsGenerate).not.toHaveBeenCalled();
    const [updated] = await loadFlashcards("Spanish");
    expect(updated.contexts.map((c) => c.source)).toEqual(["ctx-a", "ctx-b"]);
  });
});

describe("addMissingAudioFor", () => {
  it("strips ** markers from text before sending to TTS", async () => {
    vi.mocked(callTTS).mockClear();
    const card = (await addFlashcard("Spanish", "esconder", "to hide"))!;
    await updateFlashcardContexts(
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
    const [stored] = await loadFlashcards("Spanish");

    await addMissingAudioFor(stored, settings);

    expect(callTTS).toHaveBeenCalledTimes(1);
    const ttsInput = vi.mocked(callTTS).mock.calls[0][0].input;
    expect(ttsInput).not.toContain("**");
    expect(ttsInput).toBe("El gato se esconde aquí");
  });
});

describe("pickNextContext", () => {
  async function withContexts(cursor: number | undefined, n: number) {
    const card = (await addFlashcard("Spanish", `w${Math.random()}`, "x"))!;
    const ctxs = Array.from({ length: n }, (_, i) => ({
      source: `s${i}`,
      translation: `t${i}`,
      audioKey: null,
    }));
    await updateFlashcardContexts(card.id, ctxs, Date.now());
    if (cursor !== undefined) await patchFlashcard(card.id, { contextCursor: cursor });
    const all = await loadFlashcards("Spanish");
    return all.find((c) => c.id === card.id)!;
  }

  it("returns 0 when contextCursor is undefined (brand-new card)", async () => {
    expect(await pickNextContext(await withContexts(undefined, 3))).toBe(0);
  });

  it("returns the stored cursor when within bounds", async () => {
    expect(await pickNextContext(await withContexts(1, 3))).toBe(1);
    expect(await pickNextContext(await withContexts(2, 3))).toBe(2);
  });

  it("wraps via modulo when the stored cursor exceeds contexts length (e.g. after regen)", async () => {
    expect(await pickNextContext(await withContexts(5, 3))).toBe(2);
  });

  it("returns 0 safely when the card has no contexts", async () => {
    expect(await pickNextContext(await withContexts(undefined, 0))).toBe(0);
  });

  it("cycles through distinct indices on consecutive calls with the same in-memory card", async () => {
    const card = await withContexts(undefined, 3);
    expect(await pickNextContext(card)).toBe(0);
    expect(await pickNextContext(card)).toBe(1);
    expect(await pickNextContext(card)).toBe(2);
    expect(await pickNextContext(card)).toBe(0);
  });
});

describe("updateFlashcardContexts", () => {
  it("replaces contexts and updates contextsRefreshedAt", async () => {
    const card = (await addFlashcard("Spanish", "hola", "hello"))!;
    const now = Date.now();
    await updateFlashcardContexts(
      card.id,
      [{ source: "Hola mundo", translation: "Hello world", audioKey: null }],
      now,
    );

    const [updated] = await loadFlashcards("Spanish");
    expect(updated.contexts).toHaveLength(1);
    expect(updated.contexts[0].source).toBe("Hola mundo");
    expect(updated.contextsRefreshedAt).toBe(now);
  });
});
