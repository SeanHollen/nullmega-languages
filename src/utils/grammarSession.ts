import type { GrammarCard } from "./grammarCards";
import { loadGrammarCards, addGrammarCards } from "./grammarCards";
import type { GrammarSettings } from "./grammarSettings";
import { getGeneratedTodayCount, recordGeneratedToday } from "./grammarSettings";
import { generateGrammarCards } from "./generateGrammarCards";
import { pickRandom } from "./studySession";
import { computeSrsStatus } from "./srs";
export { computeSrsAnswerPatch as computeGrammarAnswerPatch } from "./srs";

export interface GrammarSessionData {
  cards: GrammarCard[];
  current: GrammarCard;
  mode: "learn" | "review";
}

export async function prepareGrammarLearnSession(
  language: string,
  settings: GrammarSettings,
): Promise<GrammarSessionData | null> {
  const toGenerate = Math.max(0, settings.newCardsPerDay - (await getGeneratedTodayCount()));

  if (toGenerate > 0) {
    const existing = await loadGrammarCards(language);
    const rawCards = await generateGrammarCards({
      language,
      level: settings.level,
      count: toGenerate,
      existingCards: existing.map((c) => ({ title: c.title, level: c.level })),
    });
    if (rawCards.length > 0) {
      await addGrammarCards(language, rawCards, settings.level);
      await recordGeneratedToday(rawCards.length);
    }
  }

  const all = await loadGrammarCards(language);
  const learning = all.filter((c) => computeSrsStatus(c) === `learning`);
  if (learning.length === 0) return null;

  return { cards: learning, current: pickRandom(learning), mode: `learn` };
}

export async function prepareGrammarReviewSession(
  language: string,
): Promise<GrammarSessionData | null> {
  const all = await loadGrammarCards(language);
  const due = all.filter((c) => {
    const s = computeSrsStatus(c);
    return s === `due` || s === `relearning`;
  });
  if (due.length === 0) return null;

  return { cards: due, current: pickRandom(due), mode: `review` };
}

// Wrong answer → show the same card again immediately so the user can retry. Right
// answer → drop from the queue and pick a different one at random.
export function pickNextGrammarCard(
  remaining: GrammarCard[],
  current: GrammarCard,
  right: boolean,
): { card: GrammarCard | null; nextRemaining: GrammarCard[] } {
  if (right) {
    const next = remaining.filter((c) => c.id !== current.id);
    return { card: next.length > 0 ? pickRandom(next) : null, nextRemaining: next };
  }
  return { card: current, nextRemaining: remaining };
}
