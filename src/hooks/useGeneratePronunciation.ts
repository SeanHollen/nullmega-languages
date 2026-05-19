import { useMutation } from "@tanstack/react-query";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getTitlesByComplexity } from "../utils/history";

export interface PronunciationPhrase {
  phrase: string;
  translation: string;
}

export interface PronunciationExerciseLlmResponse {
  title: string;
  phrases: PronunciationPhrase[];
}

export interface PronunciationExercise extends PronunciationExerciseLlmResponse {
  id?: string;
  languageComplexity: number;
}

function phraseCount(languageComplexity: number): number {
  if (languageComplexity <= 25) return 3;
  if (languageComplexity <= 50) return 4;
  if (languageComplexity <= 75) return 5;
  return 6;
}

function phraseLengthGuide(languageComplexity: number): string {
  if (languageComplexity <= 20)
    return "3-6 words each. Use very common vocabulary and basic everyday phrases";
  if (languageComplexity <= 40)
    return "5-10 words each. Use common vocabulary with some variety in tense and structure";
  if (languageComplexity <= 60)
    return "8-15 words each. Include varied grammar, some idioms, and moderately challenging vocabulary";
  if (languageComplexity <= 80)
    return "12-20 words each. Use complex sentence structures, idiomatic language, and nuanced vocabulary";
  return "15-25 words each. Include sophisticated idioms, complex grammar, and advanced vocabulary";
}

async function fetchPronunciationExercise(
  language: string,
  languageComplexity: number,
): Promise<PronunciationExercise> {
  const count = phraseCount(languageComplexity);

  const nearbyTitles = await getTitlesByComplexity(
    "pronunciation",
    language,
    languageComplexity,
    500,
  );
  const avoidanceBlock =
    nearbyTitles.length > 0
      ? `\n\nPAST THEMES at similar complexity (do not repeat any of these or close variations — pick something fresh):
${nearbyTitles.map((t) => `- ${t}`).join("\n")}`
      : "";

  const prompt = `Generate a pronunciation practice exercise in ${language} at difficulty ${languageComplexity}/100.

THEME: All ${count} phrases must belong to a single coherent topic or theme summarised by the title (e.g. "ordering at a café", "moving day", "weather complaints", "phone call with a friend"). Do not produce a grab-bag of unrelated sentences.

Return ONLY valid JSON with this exact shape:
{
  "title": "3-6 word title in ${language} describing the theme tying the phrases together",
  "phrases": [
    { "phrase": "...", "translation": "..." }
  ]
}

- Generate exactly ${count} phrases, all within the chosen theme
- Phrases should be ${phraseLengthGuide(languageComplexity)}
- Within the theme, vary the type: statements, questions, exclamations
- Phrases should be practical and natural-sounding in ${language}
- At low difficulty: prioritise common sounds and basic patterns; at high difficulty: include challenging phoneme combinations, intonation shifts, and less common vocabulary
- "translation" is the complete English translation of each phrase${avoidanceBlock}`;

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
  const parsed = JSON.parse(data.choices[0].message.content) as PronunciationExerciseLlmResponse;
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
