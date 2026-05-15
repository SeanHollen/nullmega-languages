export interface GrammarSettings {
  newCardsPerDay: number;
  level: number;
}

const KEY = `grammar_settings`;
const LEARN_SESSION_KEY = `grammar_learn_session`;

const DEFAULTS: GrammarSettings = {
  newCardsPerDay: 3,
  level: 2,
};

export const NEW_CARDS_PER_DAY_MIN = 1;
export const NEW_CARDS_PER_DAY_MAX = 20;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function loadGrammarSettings(): GrammarSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GrammarSettings>;
    return {
      newCardsPerDay:
        typeof parsed.newCardsPerDay === `number`
          ? clamp(parsed.newCardsPerDay, NEW_CARDS_PER_DAY_MIN, NEW_CARDS_PER_DAY_MAX)
          : DEFAULTS.newCardsPerDay,
      level: typeof parsed.level === `number` ? clamp(parsed.level, 1, 10) : DEFAULTS.level,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveGrammarSettings(settings: GrammarSettings): void {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

interface GenerateSession {
  date: string;
  count: number;
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getGeneratedTodayCount(): number {
  try {
    const raw = localStorage.getItem(LEARN_SESSION_KEY);
    if (!raw) return 0;
    const session = JSON.parse(raw) as GenerateSession;
    return session.date === todayString() ? session.count : 0;
  } catch {
    return 0;
  }
}

export function recordGeneratedToday(count: number): void {
  const current = getGeneratedTodayCount();
  localStorage.setItem(
    LEARN_SESSION_KEY,
    JSON.stringify({ date: todayString(), count: current + count }),
  );
}

export function shiftGrammarSessionDate(days: number): void {
  try {
    const raw = localStorage.getItem(LEARN_SESSION_KEY);
    if (!raw) return;
    const session = JSON.parse(raw) as GenerateSession;
    const d = new Date(session.date);
    d.setDate(d.getDate() - days);
    session.date = d.toISOString().slice(0, 10);
    localStorage.setItem(LEARN_SESSION_KEY, JSON.stringify(session));
  } catch {
    // ignore
  }
}
