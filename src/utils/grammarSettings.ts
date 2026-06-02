import { db } from "./db";

export interface GrammarSettings {
  newCardsPerDay: number;
  level: number;
}

function settingsKey(language: string): string {
  return `grammar_settings_${language}`;
}

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

function startOfTodayLocal(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export async function loadGrammarSettings(language: string): Promise<GrammarSettings> {
  const row = await db().kv.get(settingsKey(language));
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

export async function saveGrammarSettings(
  language: string,
  settings: GrammarSettings,
): Promise<void> {
  await db().kv.put({ key: settingsKey(language), value: settings });
}

export async function getGeneratedTodayCount(language: string): Promise<number> {
  const cutoff = startOfTodayLocal();
  return await db()
    .grammarCards.where(`language`)
    .equals(language)
    .filter((c) => c.addedAt >= cutoff)
    .count();
}
