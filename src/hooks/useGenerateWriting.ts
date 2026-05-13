import { useMutation } from "@tanstack/react-query";
import difficultyLevels from "../data/difficulty-levels.json";
import { callChat } from "../utils/api";

interface LevelRef {
  description: string;
  examples: { passage: string }[];
}

const levels = difficultyLevels as Record<string, LevelRef>;

export interface WritingQuestion {
  question: string;
  type: "short" | "essay";
  minWords?: number;
  maxWords?: number;
}

export interface WritingExercise {
  passage: string;
  translation: string;
  difficultWords: { source: string; translation: string }[];
  insight?: string;
  questions: WritingQuestion[];
}

function refBlock(level: number, label: string): string {
  const r = levels[String(level)];
  if (!r) return "";
  const exampleLines = r.examples
    .map((e, i) => `  Example ${String.fromCharCode(65 + i)}: "${e.passage}"`)
    .join("\n");
  return `${label} (level ${level}):\n  Description: ${r.description}\n${exampleLines}`;
}

function passageLengthGuide(difficulty: number): string {
  if (difficulty <= 15) return "100-150 words";
  if (difficulty <= 30) return "120-170 words";
  if (difficulty <= 50) return "140-200 words";
  return "160-220 words";
}

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function essayWordCounts(difficulty: number): { min: number; max: number } {
  const passageWords =
    difficulty <= 15
      ? 125
      : difficulty <= 30
        ? 145
        : difficulty <= 50
          ? 170
          : difficulty <= 75
            ? 185
            : 200;
  const target = Math.max(15, Math.round((difficulty / 100) * passageWords));
  return { min: roundTo5(Math.round(target * 0.8)), max: roundTo5(Math.round(target * 1.3)) };
}

async function fetchWritingExercise(
  language: string,
  difficulty: number,
): Promise<WritingExercise> {
  const lo = Math.max(1, difficulty - 1);
  const hi = Math.min(100, difficulty + 1);
  const { min, max } = essayWordCounts(difficulty);

  const referenceBlock = `Difficulty references (these illustrate the difficulty gradient, not the topic):
${refBlock(lo, "One level easier")}

${refBlock(difficulty, "Target level")}

${refBlock(hi, "One level harder")}

Match the difficulty of the target level. Choose your own topic independently.`;

  const prompt = `Generate a writing exercise in ${language} at difficulty ${difficulty}/100.

${referenceBlock}

Return ONLY valid JSON with this exact shape:
{
  "passage": "${passageLengthGuide(difficulty)} passage entirely in ${language}",
  "translation": "full English translation of the passage",
  "difficultWords": [{ "source": "word in ${language}", "translation": "English equivalent" }],
  "insight": "1-2 sentences in English noting something interesting about the language used in the passage",
  "questions": [
    { "type": "short", "question": "short-answer question in ${language} — answer should fit in one brief phrase or sentence" },
    { "type": "short", "question": "another short-answer question in ${language} — answer should fit in one brief phrase or sentence" },
    { "type": "essay", "question": "essay prompt in ${language} asking for a ${min}–${max} word response related to the passage theme" }
  ]
}

SHORT-ANSWER QUESTIONS: test specific comprehension; require understanding, not just copying words.
ESSAY QUESTION: at low levels use simple prompts (describe your own experience with the topic); at high levels use analytical or argumentative prompts.
DIFFICULT WORDS: exclude cognates an English speaker could recognise. Include genuine non-cognates, false friends, idiomatic expressions.`;

  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  const parsed = JSON.parse(data.choices[0].message.content) as WritingExercise;

  return {
    ...parsed,
    questions: parsed.questions.map((q) =>
      q.type === "essay" ? { ...q, minWords: min, maxWords: max } : q,
    ),
  };
}

export function useGenerateWriting() {
  return useMutation({
    mutationFn: ({ language, difficulty }: { language: string; difficulty: number }) =>
      fetchWritingExercise(language, difficulty),
  });
}
