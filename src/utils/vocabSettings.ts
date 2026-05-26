import { db } from "./db";

export type VocabOrder = "random" | "first-added" | "latest-added";
export type TextDisplay = "show" | "hide" | "cloze";

export interface VocabSettings {
  newWordsPerDay: number;
  contextsPerCard: number;
  order: VocabOrder;
  generateAudio: boolean;
  autoplayAudio: boolean;
  textDisplay: TextDisplay;
  includeTranslationInContexts: boolean;
}

const SETTINGS_KEY = `vocab_settings`;
const LEARN_SESSION_KEY = `vocab_learn_session`;

export const VOCAB_SETTINGS_DEFAULTS: VocabSettings = {
  newWordsPerDay: 5,
  contextsPerCard: 3,
  order: `random`,
  generateAudio: true,
  autoplayAudio: true,
  textDisplay: `cloze`,
  includeTranslationInContexts: false,
};

export const NEW_WORDS_PER_DAY_MIN = 1;
export const NEW_WORDS_PER_DAY_MAX = 50;
export const CONTEXTS_PER_CARD_MIN = 1;
export const CONTEXTS_PER_CARD_MAX = 10;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

interface LearnSession {
  date: string;
  count: number;
}

function todayString(): string {
  // Local date (matches streaks.ts and history.ts). UTC would roll over hours earlier or
  // later than the user's actual midnight, so the counters and the streak record would
  // disagree about which day "today" is — already-finished work could appear unfinished.
  const d = new Date();
  const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function loadVocabSettings(): Promise<VocabSettings> {
  const row = await db().kv.get(SETTINGS_KEY);
  const stored = row?.value as Partial<VocabSettings> | undefined;
  if (!stored) return { ...VOCAB_SETTINGS_DEFAULTS };
  return {
    ...VOCAB_SETTINGS_DEFAULTS,
    ...stored,
    newWordsPerDay: clamp(
      stored.newWordsPerDay ?? VOCAB_SETTINGS_DEFAULTS.newWordsPerDay,
      NEW_WORDS_PER_DAY_MIN,
      NEW_WORDS_PER_DAY_MAX,
    ),
    contextsPerCard: clamp(
      stored.contextsPerCard ?? VOCAB_SETTINGS_DEFAULTS.contextsPerCard,
      CONTEXTS_PER_CARD_MIN,
      CONTEXTS_PER_CARD_MAX,
    ),
  };
}

export async function saveVocabSettings(settings: VocabSettings): Promise<void> {
  await db().kv.put({ key: SETTINGS_KEY, value: settings });
}

async function loadLearnSession(): Promise<LearnSession | null> {
  const row = await db().kv.get(LEARN_SESSION_KEY);
  if (!row) return null;
  const s = row.value as Partial<LearnSession> | null;
  if (!s || typeof s.date !== `string` || typeof s.count !== `number`) return null;
  return { date: s.date, count: s.count };
}

export async function getLearnedTodayCount(): Promise<number> {
  const session = await loadLearnSession();
  if (!session) return 0;
  return session.date === todayString() ? session.count : 0;
}

export async function recordLearnedToday(count: number): Promise<void> {
  const current = await getLearnedTodayCount();
  await db().kv.put({
    key: LEARN_SESSION_KEY,
    value: { date: todayString(), count: current + count },
  });
}

export async function shiftLearnSessionDate(days: number): Promise<void> {
  const session = await loadLearnSession();
  if (!session) return;
  const d = new Date(session.date);
  d.setDate(d.getDate() - days);
  await db().kv.put({
    key: LEARN_SESSION_KEY,
    value: { date: d.toISOString().slice(0, 10), count: session.count },
  });
}
