import { db } from "./db";

// Settings that apply to BOTH vocab and grammar SRS — anything that's about how the
// state machine schedules cards lives here, not in VocabSettings or GrammarSettings.
export interface SrsSettings {
  useEaseFromHistory: boolean;
  showUpcomingBeforeLearning: boolean;
  showDueBeforeRelearning: boolean;
}

const SETTINGS_KEY = `srs_settings`;

export const SRS_SETTINGS_DEFAULTS: SrsSettings = {
  useEaseFromHistory: true,
  showUpcomingBeforeLearning: false,
  showDueBeforeRelearning: true,
};

export async function loadSrsSettings(): Promise<SrsSettings> {
  const row = await db().kv.get(SETTINGS_KEY);
  const stored = row?.value as Partial<SrsSettings> | undefined;
  if (!stored) return { ...SRS_SETTINGS_DEFAULTS };
  return { ...SRS_SETTINGS_DEFAULTS, ...stored };
}

export async function saveSrsSettings(settings: SrsSettings): Promise<void> {
  await db().kv.put({ key: SETTINGS_KEY, value: settings });
}
