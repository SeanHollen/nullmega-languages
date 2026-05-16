import { shiftLearnSessionDate } from "./vocabSettings";
import { shiftGrammarSessionDate } from "./grammarSettings";
import { saveAbility, type Mode } from "../hooks/useAbility";
import { getStoredLanguage } from "./language";

const MODES: Mode[] = ["reading", "listening", "pronunciation", "writing"];

export function setupDevTools(): void {
  (window as unknown as Record<string, unknown>).simulateTimePassing = (numDays: number) => {
    const shift = numDays * 24 * 60 * 60 * 1000;
    try {
      const cards = JSON.parse(localStorage.getItem("flashcards") ?? "[]");
      for (const card of cards) {
        if (typeof card.lastReviewed === "number") card.lastReviewed -= shift;
        if (typeof card.addedAt === "number") card.addedAt -= shift;
        if (typeof card.dateContextGenerated === "number") card.dateContextGenerated -= shift;
      }
      localStorage.setItem("flashcards", JSON.stringify(cards));

      const history = JSON.parse(localStorage.getItem("assessment_history") ?? "[]");
      for (const record of history) {
        if (typeof record.completedAt === "number") record.completedAt -= shift;
      }
      localStorage.setItem("assessment_history", JSON.stringify(history));

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.endsWith("_confidence")) continue;
        try {
          const conf = JSON.parse(localStorage.getItem(key) ?? "{}");
          if (typeof conf.updatedAt === "number") {
            conf.updatedAt -= shift;
            localStorage.setItem(key, JSON.stringify(conf));
          }
        } catch {
          // skip malformed entries
        }
      }

      const grammarCards = JSON.parse(localStorage.getItem(`grammar_cards`) ?? `[]`);
      for (const card of grammarCards) {
        if (typeof card.lastReviewed === `number`) card.lastReviewed -= shift;
        if (typeof card.addedAt === `number`) card.addedAt -= shift;
      }
      localStorage.setItem(`grammar_cards`, JSON.stringify(grammarCards));

      shiftLearnSessionDate(numDays);
      shiftGrammarSessionDate(numDays);

      console.log(`Simulated ${numDays} day(s) passing. Reload the page to see updated statuses.`);
    } catch (e) {
      console.error("simulateTimePassing failed:", e);
    }
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
    const lang = language ?? getStoredLanguage();
    saveAbility(lang, value, mode);
    console.log(
      `Set ${mode} rating for ${lang} to ${value} (clamped 1-100). Reload to see updated UI.`,
    );
  };
}
