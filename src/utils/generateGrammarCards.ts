import { callGrammar } from "./api";
import type { GrammarCategory, QuizQuestion } from "./grammarCards";
import { pickClosest } from "./proximity";
import { buildGrammarCardsPrompt, GRAMMAR_CARDS_SYSTEM_MESSAGE } from "./prompts";

export interface RawGrammarCard {
  title: string;
  prompt: string;
  category: GrammarCategory;
  questions: QuizQuestion[];
}

export async function generateGrammarCards(params: {
  language: string;
  level: number;
  count: number;
  existingCards: { title: string; level: number }[];
}): Promise<RawGrammarCard[]> {
  const { language, level, count, existingCards } = params;
  const pastTitles = pickClosest(existingCards, (c) => c.level, level, 500).map((c) => c.title);
  const prompt = buildGrammarCardsPrompt({ language, level, count, pastTitles });

  const data = await callGrammar({
    model: `o4-mini`,
    messages: [
      { role: `system`, content: GRAMMAR_CARDS_SYSTEM_MESSAGE },
      { role: `user`, content: prompt },
    ],
    response_format: { type: `json_object` },
  });

  const content = data.choices[0]?.message?.content ?? ``;
  const parsed = JSON.parse(content) as { cards?: RawGrammarCard[] };
  return (parsed.cards ?? []).slice(0, count);
}
