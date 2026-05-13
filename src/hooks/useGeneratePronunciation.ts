import { useMutation } from "@tanstack/react-query";
import { callChat } from "../utils/api";

export interface PronunciationPhrase {
  phrase: string;
  translation: string;
}

export interface PronunciationExercise {
  title: string;
  phrases: PronunciationPhrase[];
}

function phraseCount(difficulty: number): number {
  if (difficulty <= 25) return 3;
  if (difficulty <= 50) return 4;
  if (difficulty <= 75) return 5;
  return 6;
}

function phraseLengthGuide(difficulty: number): string {
  if (difficulty <= 20)
    return "3-6 words each. Use very common vocabulary and basic everyday phrases";
  if (difficulty <= 40)
    return "5-10 words each. Use common vocabulary with some variety in tense and structure";
  if (difficulty <= 60)
    return "8-15 words each. Include varied grammar, some idioms, and moderately challenging vocabulary";
  if (difficulty <= 80)
    return "12-20 words each. Use complex sentence structures, idiomatic language, and nuanced vocabulary";
  return "15-25 words each. Include sophisticated idioms, complex grammar, and advanced vocabulary";
}

async function fetchPronunciationExercise(
  language: string,
  difficulty: number,
): Promise<PronunciationExercise> {
  const count = phraseCount(difficulty);

  const prompt = `Generate a pronunciation practice exercise in ${language} at difficulty ${difficulty}/100.

Return ONLY valid JSON with this exact shape:
{
  "title": "3-6 word title in ${language} describing the theme of the phrases",
  "phrases": [
    { "phrase": "...", "translation": "..." }
  ]
}

- Generate exactly ${count} phrases
- Phrases should be ${phraseLengthGuide(difficulty)}
- Include a variety of types: statements, questions, exclamations
- Focus on phrases that are practical and natural-sounding in ${language}
- At low difficulty: prioritise common sounds and basic patterns; at high difficulty: include challenging phoneme combinations, intonation shifts, and less common vocabulary
- "translation" is the complete English translation of each phrase`;

  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return JSON.parse(data.choices[0].message.content) as PronunciationExercise;
}

export function useGeneratePronunciation() {
  return useMutation({
    mutationFn: ({ language, difficulty }: { language: string; difficulty: number }) =>
      fetchPronunciationExercise(language, difficulty),
  });
}
