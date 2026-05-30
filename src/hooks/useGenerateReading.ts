import { useMutation } from "@tanstack/react-query";
import { ExerciseLlmResponseSchema, type Exercise, type NarratorGender } from "../types";
import { callReadingExercise } from "../utils/api";
import type { ReadingLength } from "../utils/prompts";
import { shuffleQuestionOptions } from "../utils/seededRandom";
import { translateBatch, translateOne } from "./useTranslate";

async function fetchExercise(
  language: string,
  languageComplexity: number,
  length: ReadingLength,
  mode: "reading" | "listening",
): Promise<Exercise> {
  const narratorGender: NarratorGender = Math.random() < 0.5 ? `male` : `female`;
  const data = await callReadingExercise({
    language,
    languageComplexity,
    length,
    mode,
    narratorGender,
  });
  const parsed = ExerciseLlmResponseSchema.parse(JSON.parse(data.choices[0].message.content));
  const [translation, wordTranslations] = await Promise.all([
    translateOne(parsed.passage),
    translateBatch(parsed.difficultWords),
  ]);
  const difficultWords = parsed.difficultWords.map((source, i) => ({
    source,
    translation: wordTranslations[i] ?? ``,
  }));
  return {
    ...parsed,
    questions: parsed.questions.map(shuffleQuestionOptions),
    translation,
    difficultWords,
    properNouns: parsed.properNouns,
    languageComplexity,
    length,
    narratorGender,
  };
}

export function useGenerateReading() {
  return useMutation({
    mutationFn: ({
      language,
      languageComplexity,
      length,
      mode = "reading",
    }: {
      language: string;
      languageComplexity: number;
      length: ReadingLength;
      mode?: "reading" | "listening";
    }) => fetchExercise(language, languageComplexity, length, mode),
  });
}
