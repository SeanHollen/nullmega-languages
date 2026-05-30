import { z } from "zod";
import { callGrammarCardsGenerate } from "./api";

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
  const data = await callGrammarCardsGenerate(params);
  const content = data.choices[0]?.message?.content ?? ``;
  const parsed = GrammarCardsResponseSchema.parse(JSON.parse(content));
  return (parsed.cards ?? []).slice(0, params.count);
}
