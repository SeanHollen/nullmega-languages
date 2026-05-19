import { useMutation } from "@tanstack/react-query";
import type { WritingExercise } from "./useGenerateWriting";
import { callChat } from "../utils/api";
import { buildWritingGraderPrompt } from "../utils/prompts";

export interface WritingGrade {
  score: number;
  notes: string;
}

export interface WritingGrades {
  grades: WritingGrade[];
}

async function gradeAnswers(
  exercise: WritingExercise,
  answers: string[],
  language: string,
  languageComplexity: number,
): Promise<WritingGrades> {
  const prompt = buildWritingGraderPrompt({
    language,
    languageComplexity,
    passage: exercise.passage,
    questions: exercise.questions.map((q, i) => ({
      type: q.type,
      question: q.question,
      answer: answers[i],
      minWords: q.minWords,
      maxWords: q.maxWords,
    })),
  });

  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return JSON.parse(data.choices[0].message.content) as WritingGrades;
}

export function useGradeWriting() {
  return useMutation({
    mutationFn: ({
      exercise,
      answers,
      language,
      languageComplexity,
    }: {
      exercise: WritingExercise;
      answers: string[];
      language: string;
      languageComplexity: number;
    }) => gradeAnswers(exercise, answers, language, languageComplexity),
  });
}
