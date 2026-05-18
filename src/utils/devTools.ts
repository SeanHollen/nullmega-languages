import { shiftLearnSessionDate } from "./vocabSettings";
import { shiftGrammarSessionDate } from "./grammarSettings";
import { saveAbility, type Mode } from "../hooks/useAbility";
import { getStoredLanguage } from "./language";
import { db } from "./db";

const MODES: Mode[] = ["reading", "listening", "pronunciation", "writing"];

export function setupDevTools(): void {
  (window as unknown as Record<string, unknown>).simulateTimePassing = (numDays: number) => {
    const shift = numDays * 24 * 60 * 60 * 1000;
    void (async () => {
      try {
        // Shift timestamps on flashcards, grammar cards, assessments, and per-mode
        // confidence in one transaction so the simulated jump is atomic.
        await db().transaction(
          `rw`,
          [db().flashcards, db().grammarCards, db().assessments, db().abilities],
          async () => {
            const flashcards = await db().flashcards.toArray();
            for (const card of flashcards) {
              if (typeof card.lastReviewed === `number`) card.lastReviewed -= shift;
              if (typeof card.addedAt === `number`) card.addedAt -= shift;
              if (typeof card.dateContextGenerated === `number`) card.dateContextGenerated -= shift;
            }
            await db().flashcards.bulkPut(flashcards);

            const grammarCards = await db().grammarCards.toArray();
            for (const card of grammarCards) {
              if (typeof card.lastReviewed === `number`) card.lastReviewed -= shift;
              if (typeof card.addedAt === `number`) card.addedAt -= shift;
            }
            await db().grammarCards.bulkPut(grammarCards);

            const assessments = await db().assessments.toArray();
            for (const rec of assessments) {
              if (typeof rec.completedAt === `number`) rec.completedAt -= shift;
            }
            await db().assessments.bulkPut(assessments);

            const abilities = await db().abilities.toArray();
            for (const ab of abilities) {
              if (ab.confidenceUpdatedAt > 0) ab.confidenceUpdatedAt -= shift;
            }
            await db().abilities.bulkPut(abilities);
          },
        );

        await shiftLearnSessionDate(numDays);
        await shiftGrammarSessionDate(numDays);

        console.log(
          `Simulated ${numDays} day(s) passing. Reload the page to see updated statuses.`,
        );
      } catch (e) {
        console.error("simulateTimePassing failed:", e);
      }
    })();
  };

  (window as unknown as Record<string, unknown>).setRating = (
    mode: Mode,
    value: number,
    language?: string,
  ) => {
    if (!MODES.includes(mode)) {
      console.error(`setRating: mode must be one of ${MODES.join(", ")}; got "${mode}"`);
      return;
    }
    if (typeof value !== "number" || Number.isNaN(value)) {
      console.error(`setRating: value must be a number; got ${value}`);
      return;
    }
    void (async () => {
      const lang = language ?? (await getStoredLanguage());
      await saveAbility(lang, value, mode);
      console.log(
        `Set ${mode} rating for ${lang} to ${value} (clamped 1-100). Reload to see updated UI.`,
      );
    })();
  };
}
