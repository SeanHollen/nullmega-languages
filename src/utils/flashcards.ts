import { db } from "./db";

export type FlashcardStatus = "new" | "learning" | "scheduled" | "dropped";
export type FlashcardStatusDerived = FlashcardStatus | "due" | "relearning";

export interface FlashcardContext {
  source: string;
  translation: string;
  audioKey: string | null;
}

export interface Flashcard {
  id: string;
  source: string;
  translation: string;
  language: string;
  addedAt: number;
  lastReviewed: number | null;
  currentInterval: number;
  tags: string[];
  status: FlashcardStatus;
  contexts: FlashcardContext[];
  dateContextGenerated: number | null;
  // Number of consecutive correct answers given while in `learning` status. Used to require
  // multiple correct passes before graduating to `scheduled`. Resets on wrong answer and on
  // entering relearning.
  learningCorrectCount: number;
  // Timestamp of the most recent relearning event (when a `due` card was answered wrong and
  // dropped back to `learning`). null if the card has never been relearned. Persisted for
  // future stats; not currently used to drive behavior.
  relearningStartedAt: number | null;
  // Index of the next context to show. Advances (mod contexts.length) after each
  // presentation so the user cycles through contexts in order. Treated as 0 when absent.
  contextCursor?: number;
}

export async function loadFlashcards(language: string): Promise<Flashcard[]> {
  return await db().flashcards.where(`language`).equals(language).toArray();
}

async function loadCard(id: string): Promise<Flashcard | undefined> {
  return await db().flashcards.get(id);
}

export async function addFlashcard(
  language: string,
  source: string,
  translation: string,
): Promise<Flashcard | null> {
  const lower = source.toLowerCase();
  const existing = await db()
    .flashcards.where(`[language+source]`)
    .between([language, ``], [language, `￿`])
    .filter((f) => f.source.toLowerCase() === lower)
    .first();
  if (existing) return null;
  const card: Flashcard = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    source,
    translation,
    language,
    addedAt: Date.now(),
    lastReviewed: null,
    currentInterval: 0,
    tags: [],
    status: `new`,
    contexts: [],
    dateContextGenerated: null,
    learningCorrectCount: 0,
    relearningStartedAt: null,
  };
  await db().flashcards.put(card);
  return card;
}

export async function removeFlashcard(language: string, source: string): Promise<boolean> {
  const lower = source.toLowerCase();
  const card = await db()
    .flashcards.where(`language`)
    .equals(language)
    .filter((f) => f.source.toLowerCase() === lower)
    .first();
  if (!card) return false;
  await db().flashcards.delete(card.id);
  return true;
}

export async function updateFlashcardTags(id: string, tags: string[]): Promise<boolean> {
  const card = await loadCard(id);
  if (!card) return false;
  await db().flashcards.put({ ...card, tags });
  return true;
}

export async function updateFlashcardContexts(
  id: string,
  contexts: FlashcardContext[],
  dateContextGenerated: number | null,
): Promise<boolean> {
  const card = await loadCard(id);
  if (!card) return false;
  await db().flashcards.put({ ...card, contexts, dateContextGenerated });
  return true;
}

export interface ImportableCard {
  source: string;
  translation: string;
  tags?: string[];
}

export async function exportFlashcards(language: string): Promise<string> {
  const cards = await loadFlashcards(language);
  const out = cards.map<ImportableCard>((c) => ({
    source: c.source,
    translation: c.translation,
    tags: c.tags.length > 0 ? c.tags : undefined,
  }));
  return JSON.stringify(out, null, 2);
}

export async function importFlashcards(
  language: string,
  json: string,
): Promise<{ added: number; skipped: number }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Invalid JSON`);
  }
  if (!Array.isArray(parsed)) throw new Error(`Expected a JSON array of cards`);

  let added = 0;
  let skipped = 0;
  for (const item of parsed) {
    if (!item || typeof item !== `object`) {
      skipped++;
      continue;
    }
    const r = item as Record<string, unknown>;
    if (typeof r.source !== `string` || typeof r.translation !== `string`) {
      skipped++;
      continue;
    }
    const card = await addFlashcard(language, r.source, r.translation);
    if (!card) {
      skipped++;
      continue;
    }
    if (Array.isArray(r.tags)) {
      const tags = (r.tags as unknown[]).filter((t): t is string => typeof t === `string`);
      if (tags.length > 0) await updateFlashcardTags(card.id, tags);
    }
    added++;
  }
  return { added, skipped };
}

export async function patchFlashcard(id: string, patch: Partial<Flashcard>): Promise<boolean> {
  const card = await loadCard(id);
  if (!card) return false;
  await db().flashcards.put({ ...card, ...patch });
  return true;
}

export async function pickNextContext(card: Flashcard): Promise<number> {
  const len = card.contexts.length;
  if (len === 0) return 0;
  const fresh = await loadCard(card.id);
  const cursor = fresh?.contextCursor ?? card.contextCursor ?? 0;
  const idx = cursor % len;
  await patchFlashcard(card.id, { contextCursor: (idx + 1) % len });
  return idx;
}

export function computeStatus(card: Flashcard): FlashcardStatusDerived {
  if (card.status === `dropped`) return `dropped`;
  if (card.status === `new`) return `new`;
  if (card.status === `learning`) {
    return card.relearningStartedAt !== null ? `relearning` : `learning`;
  }
  if (card.lastReviewed !== null && card.lastReviewed + card.currentInterval <= Date.now())
    return `due`;
  return `scheduled`;
}
