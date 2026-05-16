import type { Flashcard } from "./flashcards";
import { loadFlashcards, computeStatus } from "./flashcards";
import type { VocabSettings, VocabOrder } from "./vocabSettings";
import { getLearnedTodayCount, recordLearnedToday } from "./vocabSettings";
import { generateContextsFor, addMissingAudioFor } from "./contextOrchestrator";
import { loadAudio } from "./audioStore";

export const DAY = 24 * 60 * 60 * 1000;
export const INTERVALS = [1, 3, 7, 14, 30, 90, 180, 365].map((d) => d * DAY);
export const INITIAL_INTERVAL = INTERVALS[0];

export function nextInterval(currentInterval: number): number {
  const idx = INTERVALS.findIndex((i) => i > currentInterval);
  return idx >= 0 ? INTERVALS[idx] : INTERVALS[INTERVALS.length - 1];
}

export function easyInterval(currentInterval: number): number {
  let interval = currentInterval;
  for (let i = 0; i < 3; i++) {
    interval = nextInterval(interval);
  }
  return interval;
}

export interface StudySessionData {
  cards: Flashcard[];
  current: Flashcard;
  contextIndex: number;
  audioUrl: string | null;
}

function suffixOf(id: string): string {
  const dash = id.indexOf("-");
  return dash >= 0 ? id.slice(dash + 1) : id;
}

export function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function pickInitial(
  cards: Flashcard[],
  mode: "learn" | "review",
  order: VocabOrder,
  newLimit: number,
): Flashcard[] {
  if (mode === "review") {
    const due = cards.filter((c) => computeStatus(c) === "due");
    return order === "added"
      ? [...due].sort((a, b) => b.addedAt - a.addedAt)
      : [...due].sort((a, b) => suffixOf(a.id).localeCompare(suffixOf(b.id)));
  }
  const newCards = cards.filter((c) => computeStatus(c) === "new");
  const learningCards = cards.filter((c) => computeStatus(c) === "learning");
  const sortedNew =
    order === "added"
      ? [...newCards].sort((a, b) => b.addedAt - a.addedAt)
      : [...newCards].sort((a, b) => suffixOf(a.id).localeCompare(suffixOf(b.id)));
  return [...sortedNew.slice(0, newLimit), ...learningCards];
}

function reloadCards(language: string, cards: Flashcard[]): Flashcard[] {
  const refreshed = loadFlashcards(language);
  const byId = new Map(refreshed.map((c) => [c.id, c]));
  return cards.map((c) => byId.get(c.id) ?? c);
}

async function initialAudioUrl(
  card: Flashcard,
  contextIndex: number,
  generateAudio: boolean,
): Promise<string | null> {
  const key = card.contexts[contextIndex]?.audioKey;
  if (!generateAudio || !key) return null;
  const blob = await loadAudio(key);
  return blob ? URL.createObjectURL(blob) : null;
}

export async function prepareLearnSession(
  language: string,
  settings: VocabSettings,
): Promise<StudySessionData | null> {
  const all = loadFlashcards(language);
  const availableNew = Math.max(0, settings.newWordsPerDay - getLearnedTodayCount());
  const picked = pickInitial(all, "learn", settings.order, availableNew);
  if (picked.length === 0) return null;

  const newCount = picked.filter((c) => c.status === "new").length;
  const needContexts = picked.filter((c) => c.contexts.length === 0);
  await Promise.all(needContexts.map((c) => generateContextsFor(c, settings)));

  if (newCount > 0) recordLearnedToday(newCount);

  const cards = reloadCards(language, picked);

  const needAudio = cards.filter(
    (c) => c.contexts.length > 0 && c.contexts.some((ctx) => !ctx.audioKey),
  );
  await Promise.all(needAudio.map((c) => addMissingAudioFor(c, settings)));

  const finalCards = needAudio.length > 0 ? reloadCards(language, cards) : cards;

  const current = pickRandom(finalCards);
  const contextIndex =
    current.contexts.length > 0 ? Math.floor(Math.random() * current.contexts.length) : 0;
  const audioUrl = await initialAudioUrl(current, contextIndex, settings.generateAudio);

  return { cards: finalCards, current, contextIndex, audioUrl };
}

export async function prepareReviewSession(
  language: string,
  settings: VocabSettings,
): Promise<StudySessionData | null> {
  const all = loadFlashcards(language);
  const picked = pickInitial(all, "review", settings.order, 0);
  if (picked.length === 0) return null;

  const needContexts = picked.filter((c) => c.contexts.length === 0);
  await Promise.all(needContexts.map((c) => generateContextsFor(c, settings)));

  const cards = reloadCards(language, picked);

  const needAudio = cards.filter(
    (c) => c.contexts.length > 0 && c.contexts.some((ctx) => !ctx.audioKey),
  );
  await Promise.all(needAudio.map((c) => addMissingAudioFor(c, settings)));

  const finalCards = needAudio.length > 0 ? reloadCards(language, cards) : cards;

  const current = pickRandom(finalCards);
  const contextIndex =
    current.contexts.length > 0 ? Math.floor(Math.random() * current.contexts.length) : 0;
  const audioUrl = await initialAudioUrl(current, contextIndex, settings.generateAudio);

  return { cards: finalCards, current, contextIndex, audioUrl };
}
