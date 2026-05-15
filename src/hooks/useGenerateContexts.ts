import { callContexts } from "../utils/api";

export interface GeneratedContext {
  source: string;
  translation: string;
}

interface Params {
  word: string;
  translation: string;
  language: string;
  count: number;
}

export async function generateContexts({
  word,
  translation,
  language,
  count,
}: Params): Promise<GeneratedContext[]> {
  const prompt = `Generate ${count} short example contexts for the ${language} word/phrase "${word}" (English meaning: "${translation}").

Each context is a short sentence or fragment in ${language} (5-15 words) that uses "${word}" exactly as written.

Requirements:
- "${word}" must appear verbatim in each ${language} context (preserve case, punctuation, conjugation if it's a multi-word phrase). For a single word, you may vary tense, gender, plurality, etc — but the dictionary form must still be recognisable.
- "${word}" should be the most complex/difficult element of the context. Surround it with simpler, common vocabulary.
- The context should make sense and stay true to the word's meaning, but should NOT give away the translation directly (no glosses, no synonyms in parentheses).
- Each context should use the word differently — vary the tense, register, situation, or sentence structure. Aim for genuine variety.

For each ${language} context, also return its full English translation. In the English translation, the target word's English equivalent should appear verbatim too (so it can be bolded).

Return ONLY valid JSON of this exact shape:
{
  "contexts": [
    { "source": "<${language} context with \\"${word}\\" inside>", "translation": "<English translation>" }
  ]
}`;

  const data = await callContexts({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = data.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as { contexts?: GeneratedContext[] };
  return (parsed.contexts ?? []).slice(0, count);
}
