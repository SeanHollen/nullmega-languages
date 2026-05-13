export interface Question {
  question: string;
  options: string[];
  correct: number;
}

export interface Exercise {
  title: string;
  passage: string;
  translation: string;
  difficultWords: { source: string; translation: string }[];
  insight: string;
  questions: Question[];
}

export type Phase = "setup" | "reading" | "results";
