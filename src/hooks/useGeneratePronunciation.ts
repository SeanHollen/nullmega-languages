import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getPastSummariesByComplexity } from "../utils/history";
import { buildPronunciationExercisePrompt } from "../utils/prompts";
import { translateBatch } from "./useTranslate";

const PronunciationExerciseLlmResponseSchema = z.object({
  title: z.string(),
  phrases: z.array(z.string()),
});

export type PronunciationExerciseLlmResponse = z.infer<
  typeof PronunciationExerciseLlmResponseSchema
>;

export interface PronunciationPhrase {
  phrase: string;
  translation: string;
}

export interface PronunciationExercise {
  id?: string;
  title: string;
  phrases: PronunciationPhrase[];
  languageComplexity: number;
}

async function fetchPronunciationExercise(
  language: string,
  languageComplexity: number,
): Promise<PronunciationExercise> {
  const pastTitles = await getPastSummariesByComplexity(
    "pronunciation",
    language,
    languageComplexity,
    500,
  );
  const prompt = buildPronunciationExercisePrompt({
    language,
    languageComplexity,
    pastTitles,
  });

  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    metadata: {
      mode: "pronunciation",
      language,
      difficulty: languageComplexity,
      userId: await getUserId(),
    },
  });
  const parsed = PronunciationExerciseLlmResponseSchema.parse(
    JSON.parse(data.choices[0].message.content),
  );
  const translations = await translateBatch(parsed.phrases);
  const phrases: PronunciationPhrase[] = parsed.phrases.map((phrase, i) => ({
    phrase,
    translation: translations[i] ?? ``,
  }));
  return { title: parsed.title, phrases, languageComplexity };
}

export function useGeneratePronunciation() {
  return useMutation({
    mutationFn: ({
      language,
      languageComplexity,
    }: {
      language: string;
      languageComplexity: number;
    }) => fetchPronunciationExercise(language, languageComplexity),
  });
}
