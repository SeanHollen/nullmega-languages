export type VocabOrder = "added" | "random";

export interface VocabSettings {
  newWordsPerDay: number;
  contextsPerCard: number;
  order: VocabOrder;
  generateAudio: boolean;
  autoplayAudio: boolean;
  showText: boolean;
}

const KEY = "vocab_settings";

const DEFAULTS: VocabSettings = {
  newWordsPerDay: 5,
  contextsPerCard: 3,
  order: "random",
  generateAudio: true,
  autoplayAudio: true,
  showText: true,
};

export const NEW_WORDS_PER_DAY_MIN = 1;
export const NEW_WORDS_PER_DAY_MAX = 50;
export const CONTEXTS_PER_CARD_MIN = 1;
export const CONTEXTS_PER_CARD_MAX = 10;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function loadVocabSettings(): VocabSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<VocabSettings>;
    return {
      newWordsPerDay:
        typeof parsed.newWordsPerDay === "number"
          ? clamp(parsed.newWordsPerDay, NEW_WORDS_PER_DAY_MIN, NEW_WORDS_PER_DAY_MAX)
          : DEFAULTS.newWordsPerDay,
      contextsPerCard:
        typeof parsed.contextsPerCard === "number"
          ? clamp(parsed.contextsPerCard, CONTEXTS_PER_CARD_MIN, CONTEXTS_PER_CARD_MAX)
          : DEFAULTS.contextsPerCard,
      order: parsed.order === "added" ? "added" : "random",
      generateAudio:
        typeof parsed.generateAudio === "boolean" ? parsed.generateAudio : DEFAULTS.generateAudio,
      autoplayAudio:
        typeof parsed.autoplayAudio === "boolean" ? parsed.autoplayAudio : DEFAULTS.autoplayAudio,
      showText: typeof parsed.showText === "boolean" ? parsed.showText : DEFAULTS.showText,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveVocabSettings(settings: VocabSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

const LEARN_SESSION_KEY = "vocab_learn_session";

interface LearnSession {
  date: string;
  count: number;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getLearnedTodayCount(): number {
  try {
    const raw = localStorage.getItem(LEARN_SESSION_KEY);
    if (!raw) return 0;
    const session = JSON.parse(raw) as LearnSession;
    return session.date === todayString() ? session.count : 0;
  } catch {
    return 0;
  }
}

export function recordLearnedToday(count: number): void {
  const current = getLearnedTodayCount();
  localStorage.setItem(
    LEARN_SESSION_KEY,
    JSON.stringify({ date: todayString(), count: current + count }),
  );
}

export function shiftLearnSessionDate(days: number): void {
  try {
    const raw = localStorage.getItem(LEARN_SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw) as LearnSession;
    const d = new Date(session.date);
    d.setDate(d.getDate() - days);
    session.date = d.toISOString().slice(0, 10);
    localStorage.setItem(LEARN_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}
