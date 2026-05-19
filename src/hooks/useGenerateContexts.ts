import { callContexts } from "../utils/api";
import { buildContextsPrompt } from "../utils/prompts";

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
  const prompt = buildContextsPrompt({ language, word, translation, count });

  const data = await callContexts({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = data.choices[0]?.message?.content ?? "";
  const parsed = JSON.parse(content) as { contexts?: GeneratedContext[] };
  return (parsed.contexts ?? []).slice(0, count);
}
