import { z } from "zod";
import { db } from "./db";
import type { SrsCard, SrsStatus, SrsStoredStatus } from "./srs";

const ImportableCardSchema = z.object({
  source: z.string(),
  translation: z.string(),
  tags: z.array(z.string()).optional(),
});

// Re-export for backwards compatibility with existing imports.
export type { ReviewEntry } from "./srs";
export type FlashcardStatus = SrsStoredStatus;
export type FlashcardStatusDerived = SrsStatus;

export interface FlashcardContext {
  source: string;
  translation: string;
  audioKey: string | null;
}

export interface Flashcard extends SrsCard {
  source: string;
  translation: string;
  contexts: FlashcardContext[];
  dateContextGenerated: number | null;
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
    learningCorrectCount: null,
    relearningStartedAt: null,
    reviewHistory: [],
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
  const arr = z.array(z.unknown()).safeParse(parsed);
  if (!arr.success) throw new Error(`Expected a JSON array of cards`);

  let added = 0;
  let skipped = 0;
  for (const item of arr.data) {
    const parsedItem = ImportableCardSchema.safeParse(item);
    if (!parsedItem.success) {
      skipped++;
      continue;
    }
    const r = parsedItem.data;
    const card = await addFlashcard(language, r.source, r.translation);
    if (!card) {
      skipped++;
      continue;
    }
    if (r.tags && r.tags.length > 0) await updateFlashcardTags(card.id, r.tags);
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

// Thin alias over the shared SRS status fn — kept for backwards compatibility.
export { computeSrsStatus as computeStatus } from "./srs";
