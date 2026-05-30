import { useMutation } from "@tanstack/react-query";
import { callVocabParagraphGrader } from "../utils/api";
import { loadNativeLanguage } from "../utils/nativeLanguageSettings";
import { WritingGradesSchema, type WritingGrade, type WritingGrades } from "./useGradeWriting";

export type { WritingGrade, WritingGrades };

async function gradeVocabParagraph(args: {
  language: string;
  languageComplexity: number;
  requiredWords: { source: string; translation: string }[];
  paragraph: string;
}): Promise<WritingGrades> {
  const nativeLanguage = await loadNativeLanguage();
  const data = await callVocabParagraphGrader({ ...args, nativeLanguage });
  return WritingGradesSchema.parse(JSON.parse(data.choices[0].message.content));
}

export function useGradeVocabParagraph() {
  return useMutation({
    mutationFn: gradeVocabParagraph,
  });
}
