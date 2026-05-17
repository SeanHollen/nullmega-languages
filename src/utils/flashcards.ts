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
}

const KEY = "flashcards";

function normalizeContext(raw: unknown): FlashcardContext | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.source !== "string" || typeof r.translation !== "string") return null;
  return {
    source: r.source,
    translation: r.translation,
    audioKey: typeof r.audioKey === "string" ? r.audioKey : null,
  };
}

function normalize(raw: unknown): Flashcard | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.source !== "string") return null;
  return {
    id: r.id,
    source: r.source,
    translation: typeof r.translation === "string" ? r.translation : "",
    language: typeof r.language === "string" ? r.language : "",
    addedAt: typeof r.addedAt === "number" ? r.addedAt : Date.now(),
    lastReviewed: typeof r.lastReviewed === "number" ? r.lastReviewed : null,
    currentInterval: typeof r.currentInterval === "number" ? r.currentInterval : 0,
    tags: Array.isArray(r.tags) ? (r.tags as string[]).filter((t) => typeof t === "string") : [],
    status:
      r.status === "new" ||
      r.status === "learning" ||
      r.status === "scheduled" ||
      r.status === "dropped"
        ? r.status
        : "new",
    contexts: Array.isArray(r.contexts)
      ? r.contexts.map(normalizeContext).filter((c): c is FlashcardContext => c !== null)
      : [],
    dateContextGenerated:
      typeof r.dateContextGenerated === "number" ? r.dateContextGenerated : null,
    learningCorrectCount: typeof r.learningCorrectCount === "number" ? r.learningCorrectCount : 0,
    relearningStartedAt: typeof r.relearningStartedAt === "number" ? r.relearningStartedAt : null,
  };
}

function load(): Flashcard[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    if (!Array.isArray(raw)) return [];
    return raw.map(normalize).filter((c): c is Flashcard => c !== null);
  } catch {
    return [];
  }
}

function persist(cards: Flashcard[]): void {
  localStorage.setItem(KEY, JSON.stringify(cards));
}

export function loadFlashcards(language: string): Flashcard[] {
  return load().filter((f) => f.language === language);
}

export function addFlashcard(
  language: string,
  source: string,
  translation: string,
): Flashcard | null {
  const cards = load();
  const exists = cards.find(
    (f) => f.language === language && f.source.toLowerCase() === source.toLowerCase(),
  );
  if (exists) return null;
  const card: Flashcard = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    source,
    translation,
    language,
    addedAt: Date.now(),
    lastReviewed: null,
    currentInterval: 0,
    tags: [],
    status: "new",
    contexts: [],
    dateContextGenerated: null,
    learningCorrectCount: 0,
    relearningStartedAt: null,
  };
  cards.push(card);
  persist(cards);
  return card;
}

export function removeFlashcard(language: string, source: string): boolean {
  const cards = load();
  const idx = cards.findIndex(
    (f) => f.language === language && f.source.toLowerCase() === source.toLowerCase(),
  );
  if (idx === -1) return false;
  cards.splice(idx, 1);
  persist(cards);
  return true;
}

export function updateFlashcardTags(id: string, tags: string[]): boolean {
  const cards = load();
  const idx = cards.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  cards[idx] = { ...cards[idx], tags };
  persist(cards);
  return true;
}

export function updateFlashcardContexts(
  id: string,
  contexts: FlashcardContext[],
  dateContextGenerated: number | null,
): boolean {
  const cards = load();
  const idx = cards.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  cards[idx] = { ...cards[idx], contexts, dateContextGenerated };
  persist(cards);
  return true;
}

export interface ImportableCard {
  source: string;
  translation: string;
  tags?: string[];
}

export function exportFlashcards(language: string): string {
  const cards = loadFlashcards(language).map<ImportableCard>((c) => ({
    source: c.source,
    translation: c.translation,
    tags: c.tags.length > 0 ? c.tags : undefined,
  }));
  return JSON.stringify(cards, null, 2);
}

export function importFlashcards(
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

  let added = 0;
  let skipped = 0;
  for (const item of parsed) {
    if (!item || typeof item !== "object") {
      skipped++;
      continue;
    }
    const r = item as Record<string, unknown>;
    if (typeof r.source !== "string" || typeof r.translation !== "string") {
      skipped++;
      continue;
    }
    const card = addFlashcard(language, r.source, r.translation);
    if (!card) {
      skipped++;
      continue;
    }
    if (Array.isArray(r.tags)) {
      const tags = (r.tags as unknown[]).filter((t): t is string => typeof t === "string");
      if (tags.length > 0) updateFlashcardTags(card.id, tags);
    }
    added++;
  }
  return { added, skipped };
}

export function patchFlashcard(id: string, patch: Partial<Flashcard>): boolean {
  const cards = load();
  const idx = cards.findIndex((f) => f.id === id);
  if (idx === -1) return false;
  cards[idx] = { ...cards[idx], ...patch };
  persist(cards);
  return true;
}

export function computeStatus(card: Flashcard): FlashcardStatusDerived {
  if (card.status === "dropped") return "dropped";
  if (card.status === "new") return "new";
  if (card.status === "learning") {
    return card.relearningStartedAt !== null ? "relearning" : "learning";
  }
  if (card.lastReviewed !== null && card.lastReviewed + card.currentInterval <= Date.now())
    return "due";
  return "scheduled";
}
