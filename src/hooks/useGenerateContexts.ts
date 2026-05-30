import { z } from "zod";
import { callContextsGenerate } from "../utils/api";
import { loadNativeLanguage } from "../utils/nativeLanguageSettings";

const GeneratedContextSchema = z.object({
  source: z.string(),
  translation: z.string(),
});

const ContextsResponseSchema = z.object({
  contexts: z.array(GeneratedContextSchema).optional(),
});

export type GeneratedContext = z.infer<typeof GeneratedContextSchema>;

interface Params {
  word: string;
  translation: string;
  includeTranslation: boolean;
  language: string;
  count: number;
}

export async function generateContexts({
  word,
  translation,
  includeTranslation,
  language,
  count,
}: Params): Promise<GeneratedContext[]> {
  const nativeLanguage = await loadNativeLanguage();
  const data = await callContextsGenerate({
    language,
    word,
    translation,
    includeTranslation,
    count,
    nativeLanguage,
  });

  const content = data.choices[0]?.message?.content ?? "";
  const parsed = ContextsResponseSchema.parse(JSON.parse(content));
  return (parsed.contexts ?? []).slice(0, count);
}
