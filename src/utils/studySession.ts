import type { Flashcard } from "./flashcards";
import { loadFlashcards, computeStatus, pickNextContext } from "./flashcards";
import type { VocabSettings, VocabOrder } from "./vocabSettings";
import { getLearnedTodayCount, recordLearnedToday } from "./vocabSettings";
import { generateContextsFor, addMissingAudioFor } from "./contextOrchestrator";
import { loadAudio } from "./db";

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

// Pure computation: given a card and an answer, returns the patch to apply and whether
// this answer graduates the card out of the session. Extracted from StudyPage so the
// transition logic is testable.
export function computeAnswerPatch(
  card: Flashcard,
  mode: "learn" | "review",
  right: boolean,
  now: number,
): { patch: Partial<Flashcard>; graduate: boolean } {
  if (mode === "learn") {
    if (right) {
      const newCount = (card.learningCorrectCount ?? 0) + 1;
      if (newCount >= LEARN_STEPS_REQUIRED) {
        return {
          graduate: true,
          patch: {
            status: "scheduled",
            lastReviewed: now,
            currentInterval: INITIAL_INTERVAL,
            learningCorrectCount: 0,
            relearningStartedAt: null,
            contexts: [],
            dateContextGenerated: null,
          },
        };
      }
      return {
        graduate: false,
        patch: { lastReviewed: now, learningCorrectCount: newCount },
      };
    }
    return {
      graduate: false,
      patch: { lastReviewed: now, learningCorrectCount: 0 },
    };
  }
  // Cards persisted before this feature shipped may not have reviewHistory; default to []
  // so we don't blow up spreading undefined.
  //
  // Only original "due event" answers are recorded — relearning-practice answers
  // (subsequent answers on a card already flagged as relearning) are follow-ups to an
  // already-recorded "incorrect" entry. Recording them too inflates per-day stats
  // (wrong-then-right would contribute 2 entries instead of 1).
  const existing = card.reviewHistory ?? [];
  const isRelearningPractice = card.relearningStartedAt !== null;
  const reviewHistory = isRelearningPractice
    ? existing
    : [
        ...existing,
        {
          outcome: (right ? "correct" : "incorrect") as "correct" | "incorrect",
          timestamp: now,
          currentInterval: card.currentInterval,
        },
      ];
  if (right) {
    // A card that was demoted earlier (relearningStartedAt !== null) graduates back to
    // scheduled at INITIAL_INTERVAL — don't re-advance via nextInterval(), or the
    // wrong answer's interval reset gets silently undone.
    const wasRelearning = card.relearningStartedAt !== null;
    return {
      graduate: true,
      patch: {
        status: "scheduled",
        lastReviewed: now,
        currentInterval: wasRelearning ? INITIAL_INTERVAL : nextInterval(card.currentInterval),
        relearningStartedAt: null,
        contexts: [],
        dateContextGenerated: null,
        reviewHistory,
      },
    };
  }
  return {
    graduate: false,
    patch: {
      lastReviewed: now,
      currentInterval: 0,
      relearningStartedAt: now,
      reviewHistory,
    },
  };
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

  const newCount = picked.filter((c) => c.status === "new").length;
  const needContexts = picked.filter((c) => c.contexts.length === 0);
  await Promise.all(needContexts.map((c) => generateContextsFor(c, settings)));

  if (newCount > 0) await recordLearnedToday(newCount);

  const cards = await reloadCards(language, picked);

  const needAudio = cards.filter(
    (c) => c.contexts.length > 0 && c.contexts.some((ctx) => !ctx.audioKey),
  );
  await Promise.all(needAudio.map((c) => addMissingAudioFor(c, settings)));

  const finalCards = needAudio.length > 0 ? await reloadCards(language, cards) : cards;

  const tierFn = buildTierFn(
    `learn`,
    settings.showUpcomingBeforeLearning,
    settings.showDueBeforeRelearning,
  );
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

  const tierFn = buildTierFn(
    `review`,
    settings.showUpcomingBeforeLearning,
    settings.showDueBeforeRelearning,
  );
  const current = pickNextCard(finalCards, tierFn);
  if (!current) return null;
  const contextIndex = current.contexts.length > 0 ? await pickNextContext(current) : 0;
  const audioUrl = await initialAudioUrl(current, contextIndex, settings.generateAudio);

  return { cards: finalCards, current, contextIndex, audioUrl };
}
