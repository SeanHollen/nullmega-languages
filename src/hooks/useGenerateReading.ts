import { useMutation } from "@tanstack/react-query";
import type { Exercise, ExerciseLlmResponse, NarratorGender } from "../types";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getPastSummariesByComplexity } from "../utils/history";
import { buildReadingExercisePrompt, type ReadingLength } from "../utils/prompts";

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
  const parsed = JSON.parse(data.choices[0].message.content) as ExerciseLlmResponse;
  return { ...parsed, languageComplexity, length, narratorGender };
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
