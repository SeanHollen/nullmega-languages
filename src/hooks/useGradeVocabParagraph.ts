import { useMutation } from "@tanstack/react-query";
import { callChat } from "../utils/api";
import { buildVocabParagraphGraderPrompt } from "../utils/prompts";
import type { WritingGrade, WritingGrades } from "./useGradeWriting";

export type { WritingGrade, WritingGrades };

async function gradeVocabParagraph(args: {
  language: string;
  languageComplexity: number;
  requiredWords: { source: string; translation: string }[];
  paragraph: string;
}): Promise<WritingGrades> {
  const prompt = buildVocabParagraphGraderPrompt(args);
  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return JSON.parse(data.choices[0].message.content) as WritingGrades;
}

export function useGradeVocabParagraph() {
  return useMutation({
    mutationFn: gradeVocabParagraph,
  });
}
