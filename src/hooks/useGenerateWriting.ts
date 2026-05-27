import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getPastSummariesByComplexity } from "../utils/history";
import { buildWritingExercisePrompt, essayWordCounts } from "../utils/prompts";

const WritingQuestionSchema = z.object({
  question: z.string(),
  type: z.enum([`short`, `essay`]),
  minWords: z.number().optional(),
  maxWords: z.number().optional(),
});

const WritingExerciseLlmResponseSchema = z.object({
  title: z.string(),
  passage: z.string(),
  translation: z.string(),
  difficultWords: z.array(z.object({ source: z.string(), translation: z.string() })),
  insight: z.string().optional(),
  questions: z.array(WritingQuestionSchema),
  summary: z.string(),
});

export type WritingQuestion = z.infer<typeof WritingQuestionSchema>;
export type WritingExerciseLlmResponse = z.infer<typeof WritingExerciseLlmResponseSchema>;

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
  const parsed = WritingExerciseLlmResponseSchema.parse(
    JSON.parse(data.choices[0].message.content),
  );

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
