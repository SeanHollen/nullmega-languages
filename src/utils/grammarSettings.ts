import { db } from "./db";

export interface GrammarSettings {
  newCardsPerDay: number;
  level: number;
}

const SETTINGS_KEY = `grammar_settings`;
const LEARN_SESSION_KEY = `grammar_learn_session`;

export const GRAMMAR_SETTINGS_DEFAULTS: GrammarSettings = {
  newCardsPerDay: 0,
  level: 20,
};

export const NEW_CARDS_PER_DAY_MIN = 0;
export const NEW_CARDS_PER_DAY_MAX = 20;
export const GRAMMAR_LEVEL_MIN = 10;
export const GRAMMAR_LEVEL_MAX = 100;
export const GRAMMAR_LEVEL_STEP = 10;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

interface GenerateSession {
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

export async function loadGrammarSettings(): Promise<GrammarSettings> {
  const row = await db().kv.get(SETTINGS_KEY);
  const stored = row?.value as Partial<GrammarSettings> | undefined;
  if (!stored) return { ...GRAMMAR_SETTINGS_DEFAULTS };
  return {
    ...GRAMMAR_SETTINGS_DEFAULTS,
    ...stored,
    newCardsPerDay: clamp(
      stored.newCardsPerDay ?? GRAMMAR_SETTINGS_DEFAULTS.newCardsPerDay,
      NEW_CARDS_PER_DAY_MIN,
      NEW_CARDS_PER_DAY_MAX,
    ),
    level: clamp(
      stored.level ?? GRAMMAR_SETTINGS_DEFAULTS.level,
      GRAMMAR_LEVEL_MIN,
      GRAMMAR_LEVEL_MAX,
    ),
  };
}

export async function saveGrammarSettings(settings: GrammarSettings): Promise<void> {
  await db().kv.put({ key: SETTINGS_KEY, value: settings });
}

async function loadSession(): Promise<GenerateSession | null> {
  const row = await db().kv.get(LEARN_SESSION_KEY);
  if (!row) return null;
  const s = row.value as Partial<GenerateSession> | null;
  if (!s || typeof s.date !== `string` || typeof s.count !== `number`) return null;
  return { date: s.date, count: s.count };
}

export async function getGeneratedTodayCount(): Promise<number> {
  const session = await loadSession();
  if (!session) return 0;
  return session.date === todayString() ? session.count : 0;
}

export async function recordGeneratedToday(count: number): Promise<void> {
  const current = await getGeneratedTodayCount();
  await db().kv.put({
    key: LEARN_SESSION_KEY,
    value: { date: todayString(), count: current + count },
  });
}

export async function shiftGrammarSessionDate(days: number): Promise<void> {
  const session = await loadSession();
  if (!session) return;
  const d = new Date(session.date);
  d.setDate(d.getDate() - days);
  await db().kv.put({
    key: LEARN_SESSION_KEY,
    value: { date: d.toISOString().slice(0, 10), count: session.count },
  });
}
