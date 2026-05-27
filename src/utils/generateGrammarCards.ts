import { z } from "zod";
import { callGrammar } from "./api";
import { pickClosest } from "./proximity";
import { buildGrammarCardsPrompt, GRAMMAR_CARDS_SYSTEM_MESSAGE } from "./prompts";

const RawGrammarCardSchema = z.object({
  title: z.string(),
  prompt: z.string(),
  tags: z.array(z.string()),
  questions: z.array(
    z.object({
      type: z.enum([`multiple-choice`, `write-in`]),
      prompt: z.string(),
      choices: z.array(z.string()).optional(),
      answer: z.union([z.string(), z.array(z.string()).min(1)]),
      shuffle: z.boolean().optional(),
    }),
  ),
});

const GrammarCardsResponseSchema = z.object({
  cards: z.array(RawGrammarCardSchema).optional(),
});

export type RawGrammarCard = z.infer<typeof RawGrammarCardSchema>;

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
  const parsed = GrammarCardsResponseSchema.parse(JSON.parse(content));
  return (parsed.cards ?? []).slice(0, count);
}
