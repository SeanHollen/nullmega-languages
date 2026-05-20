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

export interface WritingExercise extends WritingExerciseLlmResponse {
  id?: string;
  languageComplexity: number;
}

async function fetchWritingExercise(
  language: string,
  languageComplexity: number,
): Promise<WritingExercise> {
  const { min, max } = essayWordCounts(languageComplexity);
  const pastSummaries = await getPastSummariesByComplexity(
    "writing",
    language,
    languageComplexity,
    100,
  );
  const prompt = buildWritingExercisePrompt({ language, languageComplexity, pastSummaries });

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
    }: {
      language: string;
      languageComplexity: number;
    }) => fetchWritingExercise(language, languageComplexity),
  });
}
