export interface Question {
  question: string;
  options: string[];
  correct: number;
}

export interface ExerciseLlmResponse {
  title: string;
  passage: string;
  translation: string;
  difficultWords: { source: string; translation: string }[];
  insight: string;
  questions: Question[];
  summary: string;
}

export type ReadingLength = "short" | "medium" | "long";

export type NarratorGender = "male" | "female";

export interface Exercise extends ExerciseLlmResponse {
  id?: string;
  languageComplexity: number;
  length: ReadingLength;
  narratorGender: NarratorGender;
}

export type Phase = "setup" | "reading" | "results";
