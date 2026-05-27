import { z } from "zod";

export const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correct: z.number(),
});

export const ExerciseLlmResponseSchema = z.object({
  title: z.string(),
  passage: z.string(),
  translation: z.string(),
  difficultWords: z.array(z.object({ source: z.string(), translation: z.string() })),
  insight: z.string(),
  questions: z.array(QuestionSchema),
  summary: z.string(),
});

export type Question = z.infer<typeof QuestionSchema>;
export type ExerciseLlmResponse = z.infer<typeof ExerciseLlmResponseSchema>;

export type ReadingLength = "short" | "medium" | "long";

export type NarratorGender = "male" | "female";

export interface Exercise extends ExerciseLlmResponse {
  id?: string;
  languageComplexity: number;
  length: ReadingLength;
  narratorGender: NarratorGender;
}

export type Phase = "setup" | "reading" | "results";
