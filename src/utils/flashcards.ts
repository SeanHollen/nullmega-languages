export type FlashcardStatus = "new" | "learning" | "scheduled" | "due" | "dropped";

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
}

const KEY = "flashcards";

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
      r.status === "learning" ||
      r.status === "scheduled" ||
      r.status === "due" ||
      r.status === "dropped"
        ? r.status
        : "new",
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

export function computeStatus(card: Flashcard): FlashcardStatus {
  if (card.status === "dropped") return "dropped";
  if (card.status === "learning") return "learning";
  if (card.lastReviewed === null) return "new";
  if (card.lastReviewed + card.currentInterval <= Date.now()) return "due";
  return "scheduled";
}
