import { useMutation } from "@tanstack/react-query";
import { ExerciseLlmResponseSchema, type Exercise, type NarratorGender } from "../types";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getPastSummariesByComplexity } from "../utils/history";
import { buildReadingExercisePrompt, type ReadingLength } from "../utils/prompts";
import { translateBatch, translateOne } from "./useTranslate";

async function fetchExercise(
  language: string,
  languageComplexity: number,
  length: ReadingLength,
  mode: "reading" | "listening",
): Promise<Exercise> {
  const narratorGender: NarratorGender = Math.random() < 0.5 ? `male` : `female`;
  const pastSummaries = await getPastSummariesByComplexity(mode, language, languageComplexity, 100);
  const prompt = buildReadingExercisePrompt({
    language,
    languageComplexity,
    length,
    pastSummaries,
    narratorGender,
  });

  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    metadata: { mode, language, difficulty: languageComplexity, userId: await getUserId() },
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
