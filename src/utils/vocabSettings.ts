import { db } from "./db";

export type VocabOrder = "added" | "random";

export interface VocabSettings {
  newWordsPerDay: number;
  contextsPerCard: number;
  order: VocabOrder;
  generateAudio: boolean;
  autoplayAudio: boolean;
  showText: boolean;
  showUpcomingBeforeLearning: boolean;
  showDueBeforeRelearning: boolean;
  includeTranslationInContexts: boolean;
}

const SETTINGS_KEY = `vocab_settings`;
const LEARN_SESSION_KEY = `vocab_learn_session`;

const DEFAULTS: VocabSettings = {
  newWordsPerDay: 5,
  contextsPerCard: 3,
  order: `random`,
  generateAudio: true,
  autoplayAudio: true,
  showText: false,
  showUpcomingBeforeLearning: false,
  showDueBeforeRelearning: true,
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

function normalize(raw: Partial<VocabSettings> | null | undefined): VocabSettings {
  if (!raw) return { ...DEFAULTS };
  return {
    newWordsPerDay:
      typeof raw.newWordsPerDay === `number`
        ? clamp(raw.newWordsPerDay, NEW_WORDS_PER_DAY_MIN, NEW_WORDS_PER_DAY_MAX)
        : DEFAULTS.newWordsPerDay,
    contextsPerCard:
      typeof raw.contextsPerCard === `number`
        ? clamp(raw.contextsPerCard, CONTEXTS_PER_CARD_MIN, CONTEXTS_PER_CARD_MAX)
        : DEFAULTS.contextsPerCard,
    order: raw.order === `added` ? `added` : `random`,
    generateAudio:
      typeof raw.generateAudio === `boolean` ? raw.generateAudio : DEFAULTS.generateAudio,
    autoplayAudio:
      typeof raw.autoplayAudio === `boolean` ? raw.autoplayAudio : DEFAULTS.autoplayAudio,
    showText: typeof raw.showText === `boolean` ? raw.showText : DEFAULTS.showText,
    showUpcomingBeforeLearning:
      typeof raw.showUpcomingBeforeLearning === `boolean`
        ? raw.showUpcomingBeforeLearning
        : DEFAULTS.showUpcomingBeforeLearning,
    showDueBeforeRelearning:
      typeof raw.showDueBeforeRelearning === `boolean`
        ? raw.showDueBeforeRelearning
        : DEFAULTS.showDueBeforeRelearning,
    includeTranslationInContexts:
      typeof raw.includeTranslationInContexts === `boolean`
        ? raw.includeTranslationInContexts
        : DEFAULTS.includeTranslationInContexts,
  };
}

export async function loadVocabSettings(): Promise<VocabSettings> {
  const row = await db().kv.get(SETTINGS_KEY);
  return normalize(row?.value as Partial<VocabSettings> | undefined);
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
