import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { callWritingExercise } from "../utils/api";
import { essayWordCounts } from "../utils/prompts";
import { translateBatch, translateOne } from "./useTranslate";

const WritingQuestionSchema = z.object({
  question: z.string(),
  type: z.enum([`short`, `essay`]),
  minWords: z.number().optional(),
  maxWords: z.number().optional(),
});

const WritingExerciseLlmResponseSchema = z.object({
  title: z.string(),
  passage: z.string(),
  difficultWords: z.array(z.string()),
  insight: z.string().optional(),
  questions: z.array(WritingQuestionSchema),
  summary: z.string(),
});

export type WritingQuestion = z.infer<typeof WritingQuestionSchema>;
export type WritingExerciseLlmResponse = z.infer<typeof WritingExerciseLlmResponseSchema>;

export type WritingMode = "short-answer" | "dictogloss" | "vocab-paragraph";

export interface WritingExercise {
  id?: string;
  title: string;
  passage: string;
  translation: string;
  difficultWords: { source: string; translation: string }[];
  insight?: string;
  questions: WritingQuestion[];
  summary: string;
  languageComplexity: number;
  mode: WritingMode;
  // Only set when mode === "vocab-paragraph".
  requiredWords?: { source: string; translation: string }[];
}

async function fetchWritingExercise(
  language: string,
  languageComplexity: number,
  mode: "short-answer" | "dictogloss",
): Promise<WritingExercise> {
  const { min, max } = essayWordCounts(languageComplexity);
  const data = await callWritingExercise({ language, languageComplexity, mode });
  const parsed = WritingExerciseLlmResponseSchema.parse(
    JSON.parse(data.choices[0].message.content),
  );
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
