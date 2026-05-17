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

Each context is a short sentence or fragment in ${language} (5-15 words) that uses a form of "${word}".

Requirements:
- The ${language} context must use "${word}" (you may vary tense, gender, plurality, conjugation; for multi-word phrases keep the phrase together).
- In the ${language} context, wrap the exact form of "${word}" that appears with double asterisks: **like this**. Wrap only the word/phrase itself, not surrounding punctuation.
- In the English translation, wrap the English equivalent of "${word}" (whatever inflected form fits naturally) with double asterisks too.
- "${word}" should be the most complex/difficult element of the context. Surround it with simpler, common vocabulary.
- The context should make sense and stay true to the word's meaning, but should NOT give away the translation directly (no glosses, no synonyms in parentheses).
- Each context should use the word differently — vary the tense, register, situation, or sentence structure. Aim for genuine variety.

Return ONLY valid JSON of this exact shape:
{
  "contexts": [
    { "source": "<${language} context containing **${word}** (or an inflected form)>", "translation": "<English translation containing **the English equivalent**>" }
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
