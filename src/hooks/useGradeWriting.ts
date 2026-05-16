import { useMutation } from "@tanstack/react-query";
import type { WritingExercise } from "./useGenerateWriting";
import { callChat } from "../utils/api";

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
  difficulty: number,
): Promise<WritingGrades> {
  const questionBlock = exercise.questions
    .map((q, i) => {
      const typeLabel =
        q.type === "essay" ? `essay (${q.minWords}–${q.maxWords} words required)` : "short answer";
      return `Question ${i + 1} (${typeLabel}): ${q.question}\nStudent's answer: "${answers[i]}"`;
    })
    .join("\n\n");

  const prompt = `You are grading a ${language} writing exercise at difficulty ${difficulty}/100.

Passage the student read:
"${exercise.passage}"

${questionBlock}

Grade each answer from 1–5:
5 = Excellent — correct, natural ${language}, good vocabulary
4 = Good — minor errors that don't impede understanding
3 = Adequate — some errors but meaning is clear
2 = Poor — significant errors that impede understanding
1 = Very poor — mostly incorrect, incomprehensible, or blank

Return ONLY valid JSON:
{
  "grades": [
    { "score": 1-5, "notes": "..." },
    { "score": 1-5, "notes": "..." },
    { "score": 1-5, "notes": "..." }
  ]
}

For "notes": list only concrete corrections in the form "wrong → correct" (e.g. "hiver → l'hiver", "j'aime jouer → j'aime jouer au foot"). Separate multiple corrections with ", ". If the answer is perfect, write "✓". Do not write prose descriptions — only corrections. For essay answers, if the word count was not met also prepend e.g. "Word count: 18/25 minimum. " before the corrections.`;

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
      difficulty,
    }: {
      exercise: WritingExercise;
      answers: string[];
      language: string;
      difficulty: number;
    }) => gradeAnswers(exercise, answers, language, difficulty),
  });
}
