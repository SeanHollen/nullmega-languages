import { useMutation } from "@tanstack/react-query";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getRecentTitles } from "../utils/history";

export interface PronunciationPhrase {
  phrase: string;
  translation: string;
}

export interface PronunciationExercise {
  id?: string;
  title: string;
  phrases: PronunciationPhrase[];
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

  const recentTitles = getRecentTitles("pronunciation", language, 10);
  const avoidanceBlock =
    recentTitles.length > 0
      ? `\n\nRECENT THEMES (do not repeat these or use closely related themes — pick something fresh):
${recentTitles.map((t) => `- ${t}`).join("\n")}`
      : "";

  const prompt = `Generate a pronunciation practice exercise in ${language} at difficulty ${languageComplexity}/100.

Return ONLY valid JSON with this exact shape:
{
  "title": "3-6 word title in ${language} describing the theme of the phrases",
  "phrases": [
    { "phrase": "...", "translation": "..." }
  ]
}

- Generate exactly ${count} phrases
- Phrases should be ${phraseLengthGuide(languageComplexity)}
- Include a variety of types: statements, questions, exclamations
- Focus on phrases that are practical and natural-sounding in ${language}
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
      userId: getUserId(),
    },
  });
  return JSON.parse(data.choices[0].message.content) as PronunciationExercise;
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
