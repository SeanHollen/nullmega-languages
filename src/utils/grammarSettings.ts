import { db } from "./db";

export interface GrammarSettings {
  newCardsPerDay: number;
  level: number;
}

const SETTINGS_KEY = `grammar_settings`;
const LEARN_SESSION_KEY = `grammar_learn_session`;

const DEFAULTS: GrammarSettings = {
  newCardsPerDay: 3,
  level: 20,
};

export const NEW_CARDS_PER_DAY_MIN = 1;
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
  return new Date().toISOString().slice(0, 10);
}

function normalizeSettings(raw: Partial<GrammarSettings> | null | undefined): GrammarSettings {
  if (!raw) return { ...DEFAULTS };
  return {
    newCardsPerDay:
      typeof raw.newCardsPerDay === `number`
        ? clamp(raw.newCardsPerDay, NEW_CARDS_PER_DAY_MIN, NEW_CARDS_PER_DAY_MAX)
        : DEFAULTS.newCardsPerDay,
    level:
      typeof raw.level === `number`
        ? clamp(raw.level, GRAMMAR_LEVEL_MIN, GRAMMAR_LEVEL_MAX)
        : DEFAULTS.level,
  };
}

export async function loadGrammarSettings(): Promise<GrammarSettings> {
  const row = await db().kv.get(SETTINGS_KEY);
  return normalizeSettings(row?.value as Partial<GrammarSettings> | undefined);
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
