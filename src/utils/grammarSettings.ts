export interface GrammarSettings {
  newCardsPerDay: number;
  level: number;
}

const KEY = `grammar_settings`;
const LEARN_SESSION_KEY = `grammar_learn_session`;
const MIGRATION_FLAG = `grammar_levels_v2`;

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

// One-time migration: grammar levels were stored on a 1-10 scale; now they're 10-100.
// Multiplies any stored level <= 10 by 10 across settings and cards. The flag prevents
// re-running, so a future user setting level=10 on the new scale isn't re-bumped to 100.
export function migrateGrammarLevelsToHundredScale(): void {
  if (localStorage.getItem(MIGRATION_FLAG)) return;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as { level?: unknown; [k: string]: unknown };
      if (typeof s.level === `number` && s.level <= 10) {
        s.level = s.level * 10;
        localStorage.setItem(KEY, JSON.stringify(s));
      }
    }
  } catch {
    // ignore
  }
  try {
    const raw = localStorage.getItem(`grammar_cards`);
    if (raw) {
      const cards = JSON.parse(raw) as { level?: unknown; [k: string]: unknown }[];
      if (Array.isArray(cards)) {
        const migrated = cards.map((c) => {
          if (typeof c.level === `number` && c.level <= 10) {
            return { ...c, level: c.level * 10 };
          }
          return c;
        });
        localStorage.setItem(`grammar_cards`, JSON.stringify(migrated));
      }
    }
  } catch {
    // ignore
  }
  localStorage.setItem(MIGRATION_FLAG, `1`);
}

export function loadGrammarSettings(): GrammarSettings {
  migrateGrammarLevelsToHundredScale();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<GrammarSettings>;
    return {
      newCardsPerDay:
        typeof parsed.newCardsPerDay === `number`
          ? clamp(parsed.newCardsPerDay, NEW_CARDS_PER_DAY_MIN, NEW_CARDS_PER_DAY_MAX)
          : DEFAULTS.newCardsPerDay,
      level:
        typeof parsed.level === `number`
          ? clamp(parsed.level, GRAMMAR_LEVEL_MIN, GRAMMAR_LEVEL_MAX)
          : DEFAULTS.level,
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
