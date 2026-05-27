import type { Flashcard } from "./flashcards";
import { loadFlashcards, computeStatus, pickNextContext } from "./flashcards";
import type { VocabSettings, VocabOrder } from "./vocabSettings";
import { getLearnedTodayCount } from "./vocabSettings";
import { loadSrsSettings } from "./srsSettings";
import { generateContextsFor, addMissingAudioFor } from "./contextOrchestrator";
import { loadAudio } from "./db";
import { computeSrsAnswerPatch } from "./srs";

// Re-exports — the canonical definitions live in srs.ts. Kept here so existing imports
// continue to work without a sweep of every caller.
export { INITIAL_INTERVAL, INTERVAL_MULTIPLIER, incrementedInterval } from "./srs";

export const DAY = 24 * 60 * 60 * 1000;

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

export type TierFn = (card: Flashcard) => number;

// Picks the next card from `cards`. If `tierFn` is provided, only cards in the lowest
// (highest-priority) non-empty tier are eligible. If omitted, picks uniformly at random
// from the entire list — used when the user has disabled tier-based ordering.
export function pickNextCard(cards: Flashcard[], tierFn?: TierFn): Flashcard | null {
  if (cards.length === 0) return null;
  if (!tierFn) return pickRandom(cards);
  let minTier = Number.POSITIVE_INFINITY;
  for (const c of cards) {
    const t = tierFn(c);
    if (t < minTier) minTier = t;
  }
  const pool = cards.filter((c) => tierFn(c) === minTier);
  return pickRandom(pool);
}

// Builds the tier function for a study session based on the user's ordering preferences.
// Lower numbers = higher priority. Returns undefined when the user has opted out of
// tiering for this mode (pickNextCard then chooses uniformly at random).
export function buildTierFn(
  mode: "learn" | "review",
  showUpcomingBeforeLearning: boolean,
  showDueBeforeRelearning: boolean,
): TierFn | undefined {
  if (mode === "learn") {
    if (!showUpcomingBeforeLearning) return undefined;
    // 0 = upcoming (never seen), 1 = in-progress learning.
    return (c) => (c.learningCorrectCount === null ? 0 : 1);
  }
  if (!showDueBeforeRelearning) return undefined;
  // 0 = clean due, 1 = relearning (due + flag).
  return (c) => (c.relearningStartedAt !== null ? 1 : 0);
}

export const LEARN_STEPS_REQUIRED = 2;

// Vocab wrapper around the shared SRS state machine. Delegates the state transition to
// computeSrsAnswerPatch, then layers vocab-specific context clearing on graduation
// (forces fresh context regeneration when the card next surfaces).
export function computeAnswerPatch(
  card: Flashcard,
  mode: "learn" | "review",
  right: boolean,
  now: number,
  useEase: boolean,
): { patch: Partial<Flashcard>; graduate: boolean } {
  const { patch, graduate } = computeSrsAnswerPatch(
    card,
    mode,
    right,
    now,
    LEARN_STEPS_REQUIRED,
    useEase,
  );
  if (graduate) {
    return {
      graduate: true,
      patch: { ...patch, contexts: [], dateContextGenerated: null },
    };
  }
  return { patch, graduate };
}

// Pure computation: returns the patch for removing a single context from a card.
// When the removed context is the last one, also clears dateContextGenerated so the
// card will regenerate fresh contexts the next time it is studied.
export function computeRemoveContextPatch(
  card: Flashcard,
  contextIndex: number,
): { patch: Partial<Flashcard>; removedAudioKey: string | null } {
  const removed = card.contexts[contextIndex] ?? null;
  const newContexts = card.contexts.filter((_, i) => i !== contextIndex);
  if (newContexts.length === 0) {
    return {
      patch: { contexts: [], dateContextGenerated: null },
      removedAudioKey: removed?.audioKey ?? null,
    };
  }
  return {
    patch: { contexts: newContexts },
    removedAudioKey: removed?.audioKey ?? null,
  };
}

function pickInitial(
  cards: Flashcard[],
  mode: "learn" | "review",
  order: VocabOrder,
  newLimit: number,
): Flashcard[] {
  if (mode === "review") {
    const due = cards.filter((c) => {
      const s = computeStatus(c);
      return s === "due" || s === "relearning";
    });
    return sortByOrder(due, order);
  }
  const newCards = cards.filter((c) => computeStatus(c) === "new");
  const learningCards = cards.filter((c) => computeStatus(c) === "learning");
  const sortedNew = sortByOrder(newCards, order);
  return [...sortedNew.slice(0, newLimit), ...learningCards];
}

function sortByOrder(cards: Flashcard[], order: VocabOrder): Flashcard[] {
  if (order === "first-added") return [...cards].sort((a, b) => a.addedAt - b.addedAt);
  if (order === "latest-added") return [...cards].sort((a, b) => b.addedAt - a.addedAt);
  return [...cards].sort((a, b) => suffixOf(a.id).localeCompare(suffixOf(b.id)));
}

async function reloadCards(language: string, cards: Flashcard[]): Promise<Flashcard[]> {
  const refreshed = await loadFlashcards(language);
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
  const all = await loadFlashcards(language);
  const availableNew = Math.max(0, settings.newWordsPerDay - (await getLearnedTodayCount()));
  const picked = pickInitial(all, "learn", settings.order, availableNew);
  if (picked.length === 0) return null;

  const needContexts = picked.filter((c) => c.contexts.length === 0);
  await Promise.all(needContexts.map((c) => generateContextsFor(c, settings)));

  const cards = await reloadCards(language, picked);

  const needAudio = cards.filter(
    (c) => c.contexts.length > 0 && c.contexts.some((ctx) => !ctx.audioKey),
  );
  await Promise.all(needAudio.map((c) => addMissingAudioFor(c, settings)));

  const finalCards = needAudio.length > 0 ? await reloadCards(language, cards) : cards;

  const srs = await loadSrsSettings();
  const tierFn = buildTierFn(`learn`, srs.showUpcomingBeforeLearning, srs.showDueBeforeRelearning);
  const current = pickNextCard(finalCards, tierFn);
  if (!current) return null;
  const contextIndex = current.contexts.length > 0 ? await pickNextContext(current) : 0;
  const audioUrl = await initialAudioUrl(current, contextIndex, settings.generateAudio);

  return { cards: finalCards, current, contextIndex, audioUrl };
}

export async function prepareReviewSession(
  language: string,
  settings: VocabSettings,
): Promise<StudySessionData | null> {
  const all = await loadFlashcards(language);
  const picked = pickInitial(all, "review", settings.order, 0);
  if (picked.length === 0) return null;

  const needContexts = picked.filter((c) => c.contexts.length === 0);
  await Promise.all(needContexts.map((c) => generateContextsFor(c, settings)));

  const cards = await reloadCards(language, picked);

  const needAudio = cards.filter(
    (c) => c.contexts.length > 0 && c.contexts.some((ctx) => !ctx.audioKey),
  );
  await Promise.all(needAudio.map((c) => addMissingAudioFor(c, settings)));

  const finalCards = needAudio.length > 0 ? await reloadCards(language, cards) : cards;

  const srs = await loadSrsSettings();
  const tierFn = buildTierFn(`review`, srs.showUpcomingBeforeLearning, srs.showDueBeforeRelearning);
  const current = pickNextCard(finalCards, tierFn);
  if (!current) return null;
  const contextIndex = current.contexts.length > 0 ? await pickNextContext(current) : 0;
  const audioUrl = await initialAudioUrl(current, contextIndex, settings.generateAudio);

  return { cards: finalCards, current, contextIndex, audioUrl };
}
