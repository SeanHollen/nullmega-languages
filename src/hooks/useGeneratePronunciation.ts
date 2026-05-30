import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { callPronunciationExercise } from "../utils/api";
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
  const data = await callPronunciationExercise({ language, languageComplexity });
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
