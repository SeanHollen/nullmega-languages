import { useMutation } from "@tanstack/react-query";
import type { Exercise, ExerciseLlmResponse } from "../types";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getTitlesByComplexity } from "../utils/history";
import { buildReadingExercisePrompt } from "../utils/prompts";

async function fetchExercise(
  language: string,
  languageComplexity: number,
  mode: "reading" | "listening",
): Promise<Exercise> {
  const pastTitles = await getTitlesByComplexity(mode, language, languageComplexity, 500);
  const prompt = buildReadingExercisePrompt({ language, languageComplexity, pastTitles });

  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    metadata: { mode, language, difficulty: languageComplexity, userId: await getUserId() },
  });
  const parsed = JSON.parse(data.choices[0].message.content) as ExerciseLlmResponse;
  return { ...parsed, languageComplexity };
}

export function useGenerateReading() {
  return useMutation({
    mutationFn: ({
      language,
      languageComplexity,
      mode = "reading",
    }: {
      language: string;
      languageComplexity: number;
      mode?: "reading" | "listening";
    }) => fetchExercise(language, languageComplexity, mode),
  });
}
