import { useMutation } from "@tanstack/react-query";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getPastSummariesByComplexity } from "../utils/history";
import { buildWritingExercisePrompt, essayWordCounts } from "../utils/prompts";

export interface WritingQuestion {
  question: string;
  type: "short" | "essay";
  minWords?: number;
  maxWords?: number;
}

export interface WritingExerciseLlmResponse {
  title: string;
  passage: string;
  translation: string;
  difficultWords: { source: string; translation: string }[];
  insight?: string;
  questions: WritingQuestion[];
  summary: string;
}

export type WritingMode = "short-answer" | "dictogloss";

export interface WritingExercise extends WritingExerciseLlmResponse {
  id?: string;
  languageComplexity: number;
  mode: WritingMode;
}

async function fetchWritingExercise(
  language: string,
  languageComplexity: number,
  mode: WritingMode,
): Promise<WritingExercise> {
  const { min, max } = essayWordCounts(languageComplexity);
  const pastSummaries = await getPastSummariesByComplexity(
    "writing",
    language,
    languageComplexity,
    100,
  );
  const prompt = buildWritingExercisePrompt({ language, languageComplexity, mode, pastSummaries });

  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    metadata: {
      mode: "writing",
      language,
      difficulty: languageComplexity,
      userId: await getUserId(),
    },
  });
  const parsed = JSON.parse(data.choices[0].message.content) as WritingExerciseLlmResponse;

  return {
    ...parsed,
    languageComplexity,
    mode,
    questions: parsed.questions.map((q) =>
      q.type === "essay" ? { ...q, minWords: min, maxWords: max } : q,
    ),
  };
}

export function useGenerateWriting() {
  return useMutation({
    mutationFn: ({
      language,
      languageComplexity,
      mode,
    }: {
      language: string;
      languageComplexity: number;
      mode: WritingMode;
    }) => fetchWritingExercise(language, languageComplexity, mode),
  });
}
