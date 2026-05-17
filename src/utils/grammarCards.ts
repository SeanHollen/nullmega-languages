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

const KEY = `grammar_cards`;

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

function normalize(raw: unknown): GrammarCard | null {
  if (!raw || typeof raw !== `object`) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== `string` || typeof r.title !== `string`) return null;
  return {
    id: r.id,
    language: typeof r.language === `string` ? r.language : ``,
    title: r.title,
    prompt: typeof r.prompt === `string` ? r.prompt : ``,
    category: VALID_CATEGORIES.includes(r.category as GrammarCategory)
      ? (r.category as GrammarCategory)
      : `misc`,
    questions: Array.isArray(r.questions)
      ? r.questions.map(normalizeQuestion).filter((q): q is QuizQuestion => q !== null)
      : [],
    level: typeof r.level === `number` ? r.level : 1,
    status:
      r.status === `learning` ||
      r.status === `scheduled` ||
      r.status === `due` ||
      r.status === `dropped`
        ? r.status
        : `new`,
    addedAt: typeof r.addedAt === `number` ? r.addedAt : Date.now(),
    lastReviewed: typeof r.lastReviewed === `number` ? r.lastReviewed : null,
    currentInterval: typeof r.currentInterval === `number` ? r.currentInterval : 0,
  };
}

function load(): GrammarCard[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? `[]`);
    if (!Array.isArray(raw)) return [];
    return raw.map(normalize).filter((c): c is GrammarCard => c !== null);
  } catch {
    return [];
  }
}

function persist(cards: GrammarCard[]): void {
  localStorage.setItem(KEY, JSON.stringify(cards));
}

export function loadGrammarCards(language: string): GrammarCard[] {
  return load().filter((c) => c.language === language);
}

export function addGrammarCards(
  language: string,
  raw: Array<{
    title: string;
    prompt: string;
    category: GrammarCategory;
    questions: QuizQuestion[];
  }>,
  level: number,
): GrammarCard[] {
  const all = load();
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
    all.push(card);
    added.push(card);
  }
  persist(all);
  return added;
}

export function removeGrammarCard(id: string): boolean {
  const cards = load();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  cards.splice(idx, 1);
  persist(cards);
  return true;
}

export function patchGrammarCard(id: string, patch: Partial<GrammarCard>): boolean {
  const cards = load();
  const idx = cards.findIndex((c) => c.id === id);
  if (idx === -1) return false;
  cards[idx] = { ...cards[idx], ...patch };
  persist(cards);
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

export function exportGrammarCards(language: string): string {
  const cards = loadGrammarCards(language).map<ImportableGrammarCard>((c) => ({
    title: c.title,
    prompt: c.prompt,
    category: c.category,
    questions: c.questions,
    level: c.level,
  }));
  return JSON.stringify(cards, null, 2);
}

export function importGrammarCards(
  language: string,
  json: string,
): { added: number; skipped: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error(`Invalid JSON`);
  }
  if (!Array.isArray(parsed)) throw new Error(`Expected a JSON array of cards`);

  const existing = load();
  const existingTitles = new Set(
    existing.filter((c) => c.language === language).map((c) => c.title.toLowerCase()),
  );

  let added = 0;
  let skipped = 0;
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      skipped++;
      continue;
    }
    const r = item as Record<string, unknown>;
    if (typeof r.title !== "string" || typeof r.prompt !== "string") {
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
      : "misc";
    const level = typeof r.level === "number" ? r.level : 1;
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
      status: "learning",
    };
    existing.push(card);
    existingTitles.add(r.title.toLowerCase());
    added++;
  }
  persist(existing);
  return { added, skipped };
}
