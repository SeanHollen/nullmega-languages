import { z } from "zod";
import { db } from "./db";
import type { SrsCard } from "./srs";

// Re-export for backwards compatibility with existing imports.
export type {
  SrsStoredStatus as GrammarCardStatus,
  SrsStatus as GrammarCardStatusDerived,
} from "./srs";

const QuizQuestionSchema = z.object({
  type: z.enum([`multiple-choice`, `write-in`]),
  prompt: z.string(),
  choices: z.array(z.string()).optional(),
  answer: z.union([z.string(), z.array(z.string()).min(1)]),
  shuffle: z.boolean().optional(),
});

export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

const ImportableGrammarCardSchema = z.object({
  title: z.string(),
  prompt: z.string(),
  tags: z.array(z.string()).optional(),
  questions: z.array(z.unknown()).optional(),
  level: z.number().optional(),
});

export function acceptedAnswers(q: QuizQuestion): string[] {
  return Array.isArray(q.answer) ? q.answer : [q.answer];
}

export function shuffledChoices(
  q: QuizQuestion,
  seed: number,
  shuffle = q.shuffle ?? true,
): string[] {
  const choices = q.choices ?? [];
  if (!shuffle || choices.length <= 1) return choices;
  let s = seed | 0 || 1;
  function next(): number {
    s = (s * 1664525 + 1013904223) | 0;
    return s;
  }
  return choices
    .map((c) => ({ c, k: next() }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.c);
}

export interface GrammarCard extends SrsCard {
  title: string;
  prompt: string;
  questions: QuizQuestion[];
  level: number;
}

function normalizeQuestion(raw: unknown): QuizQuestion | null {
  const result = QuizQuestionSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export async function loadGrammarCards(language: string): Promise<GrammarCard[]> {
  return await db().grammarCards.where(`language`).equals(language).toArray();
}

export async function addGrammarCards(
  language: string,
  raw: Array<{
    title: string;
    prompt: string;
    tags: string[];
    questions: QuizQuestion[];
  }>,
  level: number,
): Promise<GrammarCard[]> {
  const added: GrammarCard[] = [];
  for (const c of raw) {
    const card: GrammarCard = {
      ...c,
      language,
      level,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      addedAt: Date.now(),
      tags: c.tags,
      lastReviewed: null,
      currentInterval: 0,
      status: `learning`,
      relearningStartedAt: null,
      learningCorrectCount: null,
      reviewHistory: [],
    };
    added.push(card);
  }
  if (added.length > 0) await db().grammarCards.bulkPut(added);
  return added;
}

export async function removeGrammarCard(id: string): Promise<boolean> {
  const existing = await db().grammarCards.get(id);
  if (!existing) return false;
  await db().grammarCards.delete(id);
  return true;
}

export async function patchGrammarCard(id: string, patch: Partial<GrammarCard>): Promise<boolean> {
  const existing = await db().grammarCards.get(id);
  if (!existing) return false;
  await db().grammarCards.put({ ...existing, ...patch });
  return true;
}

// Thin alias over the shared SRS status fn — kept for backwards compatibility.
export { computeSrsStatus as computeGrammarStatus } from "./srs";

export interface ImportableGrammarCard {
  title: string;
  prompt: string;
  tags: string[];
  questions: QuizQuestion[];
  level: number;
}

export async function exportGrammarCards(language: string): Promise<string> {
  const cards = await loadGrammarCards(language);
  const out = cards.map<ImportableGrammarCard>((c) => ({
    title: c.title,
    prompt: c.prompt,
    tags: c.tags,
    questions: c.questions,
    level: c.level,
  }));
  return JSON.stringify(out, null, 2);
}

export async function importGrammarCards(
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

  const existing = await loadGrammarCards(language);
  const existingTitles = new Set(existing.map((c) => c.title.toLowerCase()));

  let added = 0;
  let skipped = 0;
  const toInsert: GrammarCard[] = [];
  for (const item of arr.data) {
    const parsedItem = ImportableGrammarCardSchema.safeParse(item);
    if (!parsedItem.success) {
      skipped++;
      continue;
    }
    const r = parsedItem.data;
    if (existingTitles.has(r.title.toLowerCase())) {
      skipped++;
      continue;
    }
    const questions = (r.questions ?? [])
      .map(normalizeQuestion)
      .filter((q): q is QuizQuestion => q !== null);
    if (questions.length === 0) {
      skipped++;
      continue;
    }
    const card: GrammarCard = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      language,
      title: r.title,
      prompt: r.prompt,
      questions,
      level: r.level ?? 1,
      addedAt: Date.now(),
      tags: r.tags ?? [],
      lastReviewed: null,
      currentInterval: 0,
      status: `learning`,
      relearningStartedAt: null,
      learningCorrectCount: null,
      reviewHistory: [],
    };
    toInsert.push(card);
    existingTitles.add(r.title.toLowerCase());
    added++;
  }
  if (toInsert.length > 0) await db().grammarCards.bulkPut(toInsert);
  return { added, skipped };
}
