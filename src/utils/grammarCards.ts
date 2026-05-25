import { db } from "./db";
import type { SrsCard } from "./srs";

// Re-export for backwards compatibility with existing imports.
export type {
  SrsStoredStatus as GrammarCardStatus,
  SrsStatus as GrammarCardStatusDerived,
} from "./srs";

export interface QuizQuestion {
  type: "multiple-choice" | "write-in";
  prompt: string;
  choices?: string[];
  answer: string | string[];
}

export function acceptedAnswers(q: QuizQuestion): string[] {
  return Array.isArray(q.answer) ? q.answer : [q.answer];
}

export interface GrammarCard extends SrsCard {
  title: string;
  prompt: string;
  questions: QuizQuestion[];
  level: number;
}

function normalizeQuestion(raw: unknown): QuizQuestion | null {
  if (!raw || typeof raw !== `object`) return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== `multiple-choice` && r.type !== `write-in`) return null;
  if (typeof r.prompt !== `string`) return null;
  let answer: string | string[];
  if (typeof r.answer === `string`) {
    answer = r.answer;
  } else if (Array.isArray(r.answer) && r.answer.every((a) => typeof a === `string`)) {
    answer = r.answer as string[];
    if (answer.length === 0) return null;
  } else {
    return null;
  }
  const q: QuizQuestion = { type: r.type, prompt: r.prompt, answer };
  if (r.type === `multiple-choice` && Array.isArray(r.choices)) {
    q.choices = (r.choices as unknown[]).filter((c): c is string => typeof c === `string`);
  }
  return q;
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
  if (!Array.isArray(parsed)) throw new Error(`Expected a JSON array of cards`);

  const existing = await loadGrammarCards(language);
  const existingTitles = new Set(existing.map((c) => c.title.toLowerCase()));

  let added = 0;
  let skipped = 0;
  const toInsert: GrammarCard[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== `object`) {
      skipped++;
      continue;
    }
    const r = item as Record<string, unknown>;
    if (typeof r.title !== `string` || typeof r.prompt !== `string`) {
      skipped++;
      continue;
    }
    if (existingTitles.has(r.title.toLowerCase())) {
      skipped++;
      continue;
    }
    const questions = Array.isArray(r.questions)
      ? r.questions.map(normalizeQuestion).filter((q): q is QuizQuestion => q !== null)
      : [];
    if (questions.length === 0) {
      skipped++;
      continue;
    }
    const tags = Array.isArray(r.tags)
      ? (r.tags as unknown[]).filter((t): t is string => typeof t === `string`)
      : [];
    const level = typeof r.level === `number` ? r.level : 1;
    const card: GrammarCard = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      language,
      title: r.title,
      prompt: r.prompt,
      questions,
      level,
      addedAt: Date.now(),
      tags,
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
