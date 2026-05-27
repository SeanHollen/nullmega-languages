import { db } from "./db";

export interface PronunciationSettings {
  showPhrasesByDefault: boolean;
  showTranslationsByDefault: boolean;
}

const KEY = `pronunciation_settings`;

const DEFAULTS: PronunciationSettings = {
  showPhrasesByDefault: true,
  showTranslationsByDefault: true,
};

export async function loadPronunciationSettings(): Promise<PronunciationSettings> {
  const row = await db().kv.get(KEY);
  const stored = row?.value as Partial<PronunciationSettings> | undefined;
  if (!stored) return { ...DEFAULTS };
  return { ...DEFAULTS, ...stored };
}

export async function savePronunciationSettings(settings: PronunciationSettings): Promise<void> {
  await db().kv.put({ key: KEY, value: settings });
}
