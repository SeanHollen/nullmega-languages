import Dexie, { type Table } from "dexie";
import type { StreakRecord } from "./streaks";
import type { Goals } from "./goals";
import type { Flashcard } from "./flashcards";
import type { GrammarCard } from "./grammarCards";
import type { AssessmentRecord } from "./history";

export interface GoalsRow extends Goals {
  language: string;
}

export interface KVRow {
  key: string;
  value: unknown;
}

export interface AbilityRow {
  id: string; // `${language}|${mode}`
  language: string;
  mode: string;
  rating: number | null;
  confidenceValue: number;
  confidenceUpdatedAt: number;
}

class LanguageLabDB extends Dexie {
  audio!: Table<Blob, string>;
  streaks!: Table<StreakRecord, string>;
  goals!: Table<GoalsRow, string>;
  kv!: Table<KVRow, string>;
  abilities!: Table<AbilityRow, string>;
  customLanguages!: Table<{ name: string }, string>;
  flashcards!: Table<Flashcard, string>;
  grammarCards!: Table<GrammarCard, string>;
  assessments!: Table<AssessmentRecord, string>;

  constructor() {
    super(`language-lab`);
    this.version(1).stores({ audio: `` });
    this.version(2).stores({ audio: ``, streaks: `&date` });
    this.version(3).stores({ audio: ``, streaks: `&date`, goals: `&language` });
    this.version(4).stores({
      audio: ``,
      streaks: `&date`,
      goals: `&language`,
      kv: `&key`,
    });
    this.version(5).stores({
      audio: ``,
      streaks: `&date`,
      goals: `&language`,
      kv: `&key`,
      abilities: `&id, [language+mode]`,
    });
    this.version(6).stores({
      audio: ``,
      streaks: `&date`,
      goals: `&language`,
      kv: `&key`,
      abilities: `&id, [language+mode]`,
      customLanguages: `&name`,
    });
    this.version(7).stores({
      audio: ``,
      streaks: `&date`,
      goals: `&language`,
      kv: `&key`,
      abilities: `&id, [language+mode]`,
      customLanguages: `&name`,
      flashcards: `&id, language, [language+source]`,
    });
    this.version(8).stores({
      audio: ``,
      streaks: `&date`,
      goals: `&language`,
      kv: `&key`,
      abilities: `&id, [language+mode]`,
      customLanguages: `&name`,
      flashcards: `&id, language, [language+source]`,
      grammarCards: `&id, language, [language+title]`,
    });
    this.version(9).stores({
      audio: ``,
      streaks: `&date`,
      goals: `&language`,
      kv: `&key`,
      abilities: `&id, [language+mode]`,
      customLanguages: `&name`,
      flashcards: `&id, language, [language+source]`,
      grammarCards: `&id, language, [language+title]`,
      assessments: `&id, [mode+language], completedAt, createdAt`,
    });
  }
}

// One Dexie instance for the page's lifetime. A new instance per call would leak
// live-query subscriptions and IDB handles — the broadcast fanout grows unbounded and
// the page eventually chokes. Tests reset data with table.clear() (see test-setup), not
// Dexie.delete, so we never need to rebuild.
const instance = new LanguageLabDB();

export function db(): LanguageLabDB {
  return instance;
}

// --- Audio ---

export async function saveAudio(key: string, blob: Blob): Promise<void> {
  await db().audio.put(blob, key);
}

export async function loadAudio(key: string): Promise<Blob | null> {
  const blob = await db().audio.get(key);
  return blob ?? null;
}

export async function deleteAudio(key: string): Promise<void> {
  await db().audio.delete(key);
}

export async function deleteAudioByPrefix(prefix: string): Promise<void> {
  await db().audio.where(`:id`).startsWith(prefix).delete();
}
