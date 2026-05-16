import { useMutation } from "@tanstack/react-query";
import difficultyLevels from "../data/difficulty-levels.json";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getRecentTitles } from "../utils/history";

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
  id?: string;
  title: string;
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

function passageLengthGuide(languageComplexity: number): string {
  if (languageComplexity <= 15) return "100-150 words";
  if (languageComplexity <= 30) return "120-170 words";
  if (languageComplexity <= 50) return "140-200 words";
  return "160-220 words";
}

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

function passageWordsFor(languageComplexity: number): number {
  if (languageComplexity <= 15) return 125;
  if (languageComplexity <= 30) return 145;
  if (languageComplexity <= 50) return 170;
  if (languageComplexity <= 75) return 185;
  return 200;
}

export function essayWordCounts(languageComplexity: number): { min: number; max: number } {
  const target = Math.max(
    15,
    Math.round((languageComplexity / 100) * passageWordsFor(languageComplexity)),
  );
  return { min: roundTo5(Math.round(target * 0.8)), max: roundTo5(Math.round(target * 1.3)) };
}

async function fetchWritingExercise(
  language: string,
  languageComplexity: number,
): Promise<WritingExercise> {
  const lo = Math.max(1, languageComplexity - 1);
  const hi = Math.min(100, languageComplexity + 1);
  const { min, max } = essayWordCounts(languageComplexity);

  const referenceBlock = `Difficulty references (these illustrate the difficulty gradient, not the topic):
${refBlock(lo, "One level easier")}

${refBlock(languageComplexity, "Target level")}

${refBlock(hi, "One level harder")}

Match the difficulty of the target level. Choose your own topic independently.`;

  const recentTitles = getRecentTitles("writing", language, 10);
  const avoidanceBlock =
    recentTitles.length > 0
      ? `\n\nRECENT TOPICS (do not repeat these or cover closely related ground — choose something fresh):
${recentTitles.map((t) => `- ${t}`).join("\n")}`
      : "";

  const narrativeBlock = `

NARRATIVE QUALITY:
Where the form supports it, give the passage genuine interest. Aim for at least one of:
- A clear narrative arc (setup → complication → resolution or twist)
- Disagreement, conflict, or contrasting perspectives between people or ideas
- An unexpected detail, observation, or insight that earns its place
- A protagonist with a recognisable motivation, not a generic actor
- Concrete specifics (names, places, gestures) over abstract description
Avoid bland "person does activity in pleasant location" filler — passages should be the kind of thing a reader would actually want to keep reading.`;

  const prompt = `Generate a writing exercise in ${language} at difficulty ${languageComplexity}/100.

${referenceBlock}${avoidanceBlock}${narrativeBlock}

Return ONLY valid JSON with this exact shape:
{
  "title": "3-6 word title in ${language} describing the topic of the passage",
  "passage": "${passageLengthGuide(languageComplexity)} passage entirely in ${language}",
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
    metadata: { mode: "writing", language, difficulty: languageComplexity, userId: getUserId() },
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
    mutationFn: ({
      language,
      languageComplexity,
    }: {
      language: string;
      languageComplexity: number;
    }) => fetchWritingExercise(language, languageComplexity),
  });
}
