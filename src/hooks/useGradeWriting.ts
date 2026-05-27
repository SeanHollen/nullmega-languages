import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import type { WritingExercise } from "./useGenerateWriting";
import { callChat } from "../utils/api";
import { buildWritingGraderPrompt } from "../utils/prompts";

const WritingGradeSchema = z.object({
  score: z.number(),
  notes: z.string(),
});

const WritingGradesSchema = z.object({
  grades: z.array(WritingGradeSchema),
});

export type WritingGrade = z.infer<typeof WritingGradeSchema>;
export type WritingGrades = z.infer<typeof WritingGradesSchema>;

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
  return WritingGradesSchema.parse(JSON.parse(data.choices[0].message.content));
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

export { WritingGradesSchema };
