import { db } from "./db";

export type GrammarCardStatus = "new" | "learning" | "scheduled" | "due" | "dropped";
export type GrammarCategory = "tense-conjugation" | "word-order" | "parts-of-speech" | "misc";

export interface QuizQuestion {
  type: "multiple-choice" | "write-in";
  prompt: string;
  choices?: string[];
  answer: string;
}

export interface GrammarCard {
  id: string;
  language: string;
  title: string;
  prompt: string;
  category: GrammarCategory;
  questions: QuizQuestion[];
  level: number;
  status: GrammarCardStatus;
  addedAt: number;
  lastReviewed: number | null;
  currentInterval: number;
}

const VALID_CATEGORIES: GrammarCategory[] = [
  `tense-conjugation`,
  `word-order`,
  `parts-of-speech`,
  `misc`,
];

function normalizeQuestion(raw: unknown): QuizQuestion | null {
  if (!raw || typeof raw !== `object`) return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== `multiple-choice` && r.type !== `write-in`) return null;
  if (typeof r.prompt !== `string` || typeof r.answer !== `string`) return null;
  const q: QuizQuestion = { type: r.type, prompt: r.prompt, answer: r.answer };
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
    category: GrammarCategory;
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
      lastReviewed: null,
      currentInterval: 0,
      status: `learning`,
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

export function computeGrammarStatus(card: GrammarCard): GrammarCardStatus {
  if (card.status === `dropped`) return `dropped`;
  if (card.status === `learning`) return `learning`;
  if (card.lastReviewed === null) return `new`;
  if (card.lastReviewed + card.currentInterval <= Date.now()) return `due`;
  return `scheduled`;
}

export interface ImportableGrammarCard {
  title: string;
  prompt: string;
  category: GrammarCategory;
  questions: QuizQuestion[];
  level: number;
}

export async function exportGrammarCards(language: string): Promise<string> {
  const cards = await loadGrammarCards(language);
  const out = cards.map<ImportableGrammarCard>((c) => ({
    title: c.title,
    prompt: c.prompt,
    category: c.category,
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
    const category: GrammarCategory = VALID_CATEGORIES.includes(r.category as GrammarCategory)
      ? (r.category as GrammarCategory)
      : `misc`;
    const level = typeof r.level === `number` ? r.level : 1;
    const card: GrammarCard = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      language,
      title: r.title,
      prompt: r.prompt,
      category,
      questions,
      level,
      addedAt: Date.now(),
      lastReviewed: null,
      currentInterval: 0,
      status: `learning`,
    };
    toInsert.push(card);
    existingTitles.add(r.title.toLowerCase());
    added++;
  }
  if (toInsert.length > 0) await db().grammarCards.bulkPut(toInsert);
  return { added, skipped };
}
