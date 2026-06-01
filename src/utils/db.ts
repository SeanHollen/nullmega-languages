import Dexie, { type Table } from "dexie";
import type { StreakRecord } from "./streaks";
import type { Goals } from "./goals";
import type { Flashcard } from "./flashcards";
import type { GrammarCard } from "./grammarCards";
import type { AssessmentRecord } from "./history";
import type { UsageRow } from "./apiUsage";

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
  apiUsage!: Table<UsageRow, string>;

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
    // v14: vocab settings' `order` field renamed: "added" → "latest-added" (and a new
    // "first-added" option is also available).
    this.version(14)
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
        const row = (await tx.table(`kv`).get(`vocab_settings`)) as
          | { key: string; value: Record<string, unknown> }
          | undefined;
        if (!row?.value || typeof row.value !== `object`) return;
        if (row.value.order === `added`) {
          await tx.table(`kv`).put({ ...row, value: { ...row.value, order: `latest-added` } });
        }
      });
    // v15: vocab settings' boolean `showText` becomes a tri-state `textDisplay`.
    // Existing `true` → "show"; existing `false` → "hide" (preserve behavior). New users
    // get the new default ("cloze") via DEFAULTS in vocabSettings.ts.
    this.version(15)
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
        const row = (await tx.table(`kv`).get(`vocab_settings`)) as
          | { key: string; value: Record<string, unknown> }
          | undefined;
        if (!row?.value || typeof row.value !== `object`) return;
        if (typeof row.value.showText === `boolean`) {
          const textDisplay = row.value.showText ? `show` : `hide`;
          const { showText: _showText, ...rest } = row.value;
          await tx.table(`kv`).put({ ...row, value: { ...rest, textDisplay } });
        }
      });
    // v16: `showUpcomingBeforeLearning` and `showDueBeforeRelearning` move from
    // `vocab_settings` to `srs_settings` (they apply to grammar as well as vocab).
    // Copy any existing values across, then strip them from the vocab entry.
    this.version(16)
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
        const vocabRow = (await tx.table(`kv`).get(`vocab_settings`)) as
          | { key: string; value: Record<string, unknown> }
          | undefined;
        if (!vocabRow?.value || typeof vocabRow.value !== `object`) return;
        const { showUpcomingBeforeLearning, showDueBeforeRelearning, ...rest } = vocabRow.value;
        const hasUpcoming = typeof showUpcomingBeforeLearning === `boolean`;
        const hasDue = typeof showDueBeforeRelearning === `boolean`;
        if (hasUpcoming || hasDue) {
          const srsRow = (await tx.table(`kv`).get(`srs_settings`)) as
            | { key: string; value: Record<string, unknown> }
            | undefined;
          const existing = srsRow?.value && typeof srsRow.value === `object` ? srsRow.value : {};
          const nextValue: Record<string, unknown> = { ...existing };
          if (hasUpcoming) nextValue.showUpcomingBeforeLearning = showUpcomingBeforeLearning;
          if (hasDue) nextValue.showDueBeforeRelearning = showDueBeforeRelearning;
          await tx.table(`kv`).put({ key: `srs_settings`, value: nextValue });
        }
        if (hasUpcoming || hasDue) {
          await tx.table(`kv`).put({ ...vocabRow, value: rest });
        }
      });
    // v17: BYOK cost tracking — per-call token + cost rows, indexed by timestamp and
    // by category for the stats chart.
    this.version(17).stores({
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
      apiUsage: `&id, timestamp, category`,
    });
    // v18: flashcards.dateContextGenerated → contextsRefreshedAt (pure rename; same
    // null-vs-timestamp semantics).
    this.version(18)
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
        apiUsage: `&id, timestamp, category`,
      })
      .upgrade(async (tx) => {
        const cards = (await tx.table(`flashcards`).toArray()) as (Record<string, unknown> & {
          id: string;
          dateContextGenerated?: number | null;
        })[];
        for (const c of cards) {
          if (`dateContextGenerated` in c) {
            const { dateContextGenerated, ...rest } = c;
            await tx
              .table(`flashcards`)
              .put({ ...rest, contextsRefreshedAt: dateContextGenerated ?? null });
          }
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
