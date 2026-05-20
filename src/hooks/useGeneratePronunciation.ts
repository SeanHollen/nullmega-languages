import { useMutation } from "@tanstack/react-query";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getPastSummariesByComplexity } from "../utils/history";
import { buildPronunciationExercisePrompt } from "../utils/prompts";

export interface PronunciationPhrase {
  phrase: string;
  translation: string;
}

export interface PronunciationExerciseLlmResponse {
  title: string;
  phrases: PronunciationPhrase[];
}

export interface PronunciationExercise extends PronunciationExerciseLlmResponse {
  id?: string;
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
  const prompt = buildPronunciationExercisePrompt({ language, languageComplexity, pastTitles });

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
  const parsed = JSON.parse(data.choices[0].message.content) as PronunciationExerciseLlmResponse;
  return { ...parsed, languageComplexity };
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
