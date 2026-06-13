import { z } from "zod";

export const QuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correct: z.number(),
});

export const ExerciseLlmResponseSchema = z.object({
  title: z.string(),
  passage: z.string(),
  difficultWords: z.array(z.string()),
  properNouns: z.array(z.object({ name: z.string(), description: z.string() })),
  insight: z.string(),
  questions: z.array(QuestionSchema),
  summary: z.string(),
});

export type Question = z.infer<typeof QuestionSchema>;
export type ExerciseLlmResponse = z.infer<typeof ExerciseLlmResponseSchema>;

export type ReadingLength = "short" | "medium" | "long";

export type NarratorGender = "male" | "female" | "neutral";

export interface Exercise {
  id?: string;
  title: string;
  passage: string;
  difficultWords: { source: string; translation: string }[];
  properNouns: { name: string; description: string }[];
  insight: string;
  questions: Question[];
  summary: string;
  languageComplexity: number;
  length: ReadingLength;
  narratorGender: NarratorGender;
}

export type Phase = "setup" | "reading" | "results";
