import { useMutation } from "@tanstack/react-query";
import { ExerciseLlmResponseSchema, type Exercise } from "../types";
import { callReadingExercise } from "../utils/api";
import type { ReadingLength } from "../utils/prompts";
import { shuffleQuestionOptions } from "../utils/seededRandom";
import { pickNarratorGender } from "../utils/tts";
import { translateBatch } from "./useTranslate";

async function fetchExercise(
  language: string,
  languageComplexity: number,
  length: ReadingLength,
  mode: "reading" | "listening",
): Promise<Exercise> {
  const narratorGender = pickNarratorGender();
  const data = await callReadingExercise({
    language,
    languageComplexity,
    length,
    mode,
    narratorGender,
  });
  const parsed = ExerciseLlmResponseSchema.parse(JSON.parse(data.choices[0].message.content));
  const wordTranslations = await translateBatch(parsed.difficultWords);
  const difficultWords = parsed.difficultWords.map((source, i) => ({
    source,
    translation: wordTranslations[i] ?? ``,
  }));
  return {
    ...parsed,
    questions: parsed.questions.map(shuffleQuestionOptions),
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
