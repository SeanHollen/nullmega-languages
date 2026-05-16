import {
  loadGrammarCards,
  addGrammarCards,
  computeGrammarStatus,
  GrammarCard,
} from "./grammarCards";
import { GrammarSettings, getGeneratedTodayCount, recordGeneratedToday } from "./grammarSettings";
import { generateGrammarCards } from "./generateGrammarCards";
import { pickRandom } from "./studySession";

export interface GrammarSessionData {
  cards: GrammarCard[];
  current: GrammarCard;
  mode: "learn" | "review";
}

export async function prepareGrammarLearnSession(
  language: string,
  settings: GrammarSettings,
): Promise<GrammarSessionData | null> {
  const toGenerate = Math.max(0, settings.newCardsPerDay - getGeneratedTodayCount());

  if (toGenerate > 0) {
    const existing = loadGrammarCards(language);
    const rawCards = await generateGrammarCards({
      language,
      level: settings.level,
      count: toGenerate,
      existingCards: existing.map((c) => ({ title: c.title, level: c.level })),
    });
    if (rawCards.length > 0) {
      addGrammarCards(language, rawCards, settings.level);
      recordGeneratedToday(rawCards.length);
    }
  }

  const all = loadGrammarCards(language);
  const learning = all.filter((c) => computeGrammarStatus(c) === `learning`);
  if (learning.length === 0) return null;

  return { cards: learning, current: pickRandom(learning), mode: `learn` };
}

export async function prepareGrammarReviewSession(
  language: string,
): Promise<GrammarSessionData | null> {
  const all = loadGrammarCards(language);
  const due = all.filter((c) => computeGrammarStatus(c) === `due`);
  if (due.length === 0) return null;

  return { cards: due, current: pickRandom(due), mode: `review` };
}
