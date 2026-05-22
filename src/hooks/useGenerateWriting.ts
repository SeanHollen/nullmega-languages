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

export type WritingMode = "short-answer" | "dictogloss" | "vocab-paragraph";

export interface WritingExercise extends WritingExerciseLlmResponse {
  id?: string;
  languageComplexity: number;
  mode: WritingMode;
  // Only populated for `vocab-paragraph`: the user's own vocab words the paragraph must
  // incorporate. The grader checks the student's paragraph against this list.
  requiredWords?: { source: string; translation: string }[];
}

async function fetchWritingExercise(
  language: string,
  languageComplexity: number,
  mode: "short-answer" | "dictogloss",
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
      mode: "short-answer" | "dictogloss";
    }) => fetchWritingExercise(language, languageComplexity, mode),
  });
}

// Constructs a vocab-paragraph WritingExercise locally — no LLM call, since the
// "exercise" is just the user's own upcoming vocab words.
export function buildVocabParagraphExercise(args: {
  languageComplexity: number;
  requiredWords: { source: string; translation: string }[];
}): WritingExercise {
  return {
    title: ``,
    passage: ``,
    translation: ``,
    difficultWords: [],
    questions: [],
    summary: ``,
    languageComplexity: args.languageComplexity,
    mode: `vocab-paragraph`,
    requiredWords: args.requiredWords,
  };
}
