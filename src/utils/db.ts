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
  streaks!: Table<StreakRecord, string>; // legacy table, unused since v10
  streaksLang!: Table<StreakRecord, [string, string]>;
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
    // v10: per-language streaks. Dexie can't change a table's primary key in-place,
    // so we add a new table `streaksLang` with compound PK [language+date] and migrate
    // existing global records into it, attributing them to whatever language was
    // selected at upgrade time. The legacy `streaks` table is left in place unused.
    this.version(10)
      .stores({
        audio: ``,
        streaks: `&date`,
        streaksLang: `&[language+date], date, language`,
        goals: `&language`,
        kv: `&key`,
        abilities: `&id, [language+mode]`,
        customLanguages: `&name`,
        flashcards: `&id, language, [language+source]`,
        grammarCards: `&id, language, [language+title]`,
        assessments: `&id, [mode+language], completedAt, createdAt`,
      })
      .upgrade(async (tx) => {
        const kvRow = (await tx.table(`kv`).get(`selectedLanguage`)) as
          | { value?: unknown }
          | undefined;
        const lang = typeof kvRow?.value === `string` ? kvRow.value : `French`;
        const oldRecords = (await tx.table(`streaks`).toArray()) as {
          date: string;
          hadObligations: boolean;
          complete: boolean;
        }[];
        for (const r of oldRecords) {
          await tx.table(`streaksLang`).put({ ...r, language: lang });
        }
      });
    // v11: relearning is now a derived state of `due + relearningStartedAt`, not of
    // `learning + relearningStartedAt`. Convert legacy relearning cards (stored as
    // status=learning with the flag set) into the new representation: status=scheduled,
    // currentInterval=0 so they're immediately due, relearningStartedAt preserved.
    this.version(11)
      .stores({
        audio: ``,
        streaks: `&date`,
        streaksLang: `&[language+date], date, language`,
        goals: `&language`,
        kv: `&key`,
        abilities: `&id, [language+mode]`,
        customLanguages: `&name`,
        flashcards: `&id, language, [language+source]`,
        grammarCards: `&id, language, [language+title]`,
        assessments: `&id, [mode+language], completedAt, createdAt`,
      })
      .upgrade(async (tx) => {
        const cards = (await tx.table(`flashcards`).toArray()) as Flashcard[];
        for (const c of cards) {
          if (c.status === `learning` && c.relearningStartedAt !== null) {
            await tx.table(`flashcards`).put({
              ...c,
              status: `scheduled`,
              lastReviewed: c.lastReviewed ?? Date.now(),
              currentInterval: 0,
              learningCorrectCount: 0,
            });
          }
        }
      });
    // v12: grammar cards now share the full SrsCard shape (tags, learningCorrectCount,
    // reviewHistory, relearningStartedAt). Backfill missing fields on existing rows.
    this.version(12)
      .stores({
        audio: ``,
        streaks: `&date`,
        streaksLang: `&[language+date], date, language`,
        goals: `&language`,
        kv: `&key`,
        abilities: `&id, [language+mode]`,
        customLanguages: `&name`,
        flashcards: `&id, language, [language+source]`,
        grammarCards: `&id, language, [language+title]`,
        assessments: `&id, [mode+language], completedAt, createdAt`,
      })
      .upgrade(async (tx) => {
        const cards = (await tx.table(`grammarCards`).toArray()) as Partial<GrammarCard>[];
        for (const c of cards) {
          if (!c.id) continue;
          await tx.table(`grammarCards`).put({
            ...c,
            tags: c.tags ?? [],
            relearningStartedAt: c.relearningStartedAt ?? null,
            learningCorrectCount: c.learningCorrectCount ?? null,
            reviewHistory: c.reviewHistory ?? [],
          });
        }
      });
    // v13: grammar cards' `category` field is replaced by `tags`. Convert existing
    // categories into a single tag and drop the field.
    this.version(13)
      .stores({
        audio: ``,
        streaks: `&date`,
        streaksLang: `&[language+date], date, language`,
        goals: `&language`,
        kv: `&key`,
        abilities: `&id, [language+mode]`,
        customLanguages: `&name`,
        flashcards: `&id, language, [language+source]`,
        grammarCards: `&id, language, [language+title]`,
        assessments: `&id, [mode+language], completedAt, createdAt`,
      })
      .upgrade(async (tx) => {
        const cards = (await tx.table(`grammarCards`).toArray()) as (Partial<GrammarCard> & {
          category?: string;
        })[];
        for (const c of cards) {
          if (!c.id) continue;
          const { category, ...rest } = c;
          const tagFromCategory = typeof category === `string` ? [category] : [];
          const mergedTags = [...new Set([...(c.tags ?? []), ...tagFromCategory])];
          await tx.table(`grammarCards`).put({ ...rest, tags: mergedTags });
        }
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
