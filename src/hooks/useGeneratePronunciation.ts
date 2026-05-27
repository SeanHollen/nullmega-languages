import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getPastSummariesByComplexity } from "../utils/history";
import { buildPronunciationExercisePrompt } from "../utils/prompts";

const PronunciationPhraseSchema = z.object({
  phrase: z.string(),
  translation: z.string(),
});

const PronunciationExerciseLlmResponseSchema = z.object({
  title: z.string(),
  phrases: z.array(PronunciationPhraseSchema),
});

export type PronunciationPhrase = z.infer<typeof PronunciationPhraseSchema>;
export type PronunciationExerciseLlmResponse = z.infer<
  typeof PronunciationExerciseLlmResponseSchema
>;

export interface PronunciationExercise extends PronunciationExerciseLlmResponse {
  id?: string;
  languageComplexity: number;
}

async function fetchPronunciationExercise(
  language: string,
  languageComplexity: number,
): Promise<PronunciationExercise> {
  const pastTitles = await getPastSummariesByComplexity(
    "pronunciation",
    language,
    languageComplexity,
    500,
  );
  const prompt = buildPronunciationExercisePrompt({ language, languageComplexity, pastTitles });

  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    metadata: {
      mode: "pronunciation",
      language,
      difficulty: languageComplexity,
      userId: await getUserId(),
    },
  });
  const parsed = PronunciationExerciseLlmResponseSchema.parse(
    JSON.parse(data.choices[0].message.content),
  );
  return { ...parsed, languageComplexity };
}

export function useGeneratePronunciation() {
  return useMutation({
    mutationFn: ({
      language,
      languageComplexity,
    }: {
      language: string;
      languageComplexity: number;
    }) => fetchPronunciationExercise(language, languageComplexity),
  });
}
