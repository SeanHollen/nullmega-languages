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
}

export type ReadingLength = "short" | "medium" | "long";

export interface Exercise extends ExerciseLlmResponse {
  id?: string;
  languageComplexity: number;
  length: ReadingLength;
}

export type Phase = "setup" | "reading" | "results";
