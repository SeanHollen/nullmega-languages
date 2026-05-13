import { useMutation } from "@tanstack/react-query";
import { Exercise } from "../types";
import difficultyLevels from "../data/difficulty-levels.json";
import { callChat } from "../utils/api";

interface ExampleRef {
  passage: string;
  question?: { question: string; options: string[]; answer: number };
}

interface LevelRef {
  description: string;
  examples: ExampleRef[];
}

const levels = difficultyLevels as Record<string, LevelRef>;

function refBlock(level: number, label: string): string {
  const r = levels[String(level)];
  if (!r) return "";
  const exampleLines = r.examples
    .map((e, i) => {
      const letter = String.fromCharCode(65 + i);
      const qLine = e.question
        ? `\n  Question ${letter}: "${e.question.question}" — correct answer: "${e.question.options[e.question.answer ?? 0]}"`
        : "";
      return `  Example ${letter}: "${e.passage}"${qLine}`;
    })
    .join("\n");
  return `${label} (level ${level}):
  Description: ${r.description}
${exampleLines}`;
}

function passageLengthGuide(difficulty: number): string {
  if (difficulty <= 15)
    return "100-150 words. At this level, achieve length through simple conversations, repetitive sentence structures, lists of objects or actions, or labelled descriptions — not by using complex vocabulary or grammar";
  if (difficulty <= 30)
    return "120-170 words. Use dialogue, simple narratives with repeated patterns, or descriptive lists to fill the length while keeping language elementary";
  if (difficulty <= 50) return "140-200 words";
  return "160-220 words";
}

async function fetchExercise(language: string, difficulty: number): Promise<Exercise> {
  const lo = Math.max(1, difficulty - 1);
  const hi = Math.min(100, difficulty + 1);

  const referenceBlock = `Difficulty references (based on English examples — these illustrate the difficulty gradient, not the topic):
${refBlock(lo, "One level easier")}

${refBlock(difficulty, "Target level")}

${refBlock(hi, "One level harder")}

Match the difficulty of the target level. The topic and content of your passage should be chosen independently — do not anchor on the topics in the examples above.`;

  const prompt = `Generate a reading comprehension exercise in ${language} at difficulty ${difficulty}/100.

${referenceBlock}

Return ONLY valid JSON with this exact shape:
{
  "title": "3-6 word title in ${language} describing the topic of the passage",
  "passage": "${passageLengthGuide(difficulty)} passage entirely in ${language}",
  "translation": "full English translation of the passage",
  "difficultWords": [{ "source": "word in ${language}", "translation": "English equivalent" }],
  "insight": "1-2 sentences in English noting something genuinely interesting about the passage — an unusual grammatical construction, a subtle idiomatic choice, a register shift, or a structural feature worth a learner's attention. Scale depth to the difficulty level.",
  "questions": [
    {
      "question": "question in ${language}",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": 0
    },
    "... 3-6 questions total ..."
  ]
}

- Generate 3 to 6 questions, scaled to passage length — shorter passages get 3, longer ones up to 6. All text in ${language}.
- "correct" is the 0-based index of the correct answer

DIFFICULT WORDS — what to include and what to exclude:
- Include: words an English speaker is unlikely to recognise or correctly guess — non-cognates, false friends, idiomatic expressions, words with unexpected meanings in context
- Exclude: cognates and near-cognates — words whose meaning is obvious or easily inferred from their resemblance to English (e.g. "biodiversité", "naturellement", "décision", "organisation"). If an English speaker could look at the word and correctly guess its meaning, do not mark it as difficult.
- Scale the list to the difficulty level: at low levels, even a few genuinely opaque words count; at high levels, include subtler vocabulary like register-specific or idiomatic terms

QUESTION QUALITY:
Before finalising each question, apply this test: "Could someone answer this correctly by searching for the question's key noun or verb in the passage and picking the option whose words appear nearby?" If yes, rewrite it. Specifically:
- Use paraphrase and synonyms in questions and answer choices rather than lifting phrases verbatim from the passage
- Require inference, logical conclusion, understanding of word meaning in context, or recognition of tone/intent — not just recall
- Wrong options must be plausible: either true statements from the passage that don't actually answer the question, or near-correct conclusions that fail on a subtle point
- A question or two can be more direct at lower difficulty levels, but even then the answer should require understanding, not matching

ANSWER OPTION LENGTH:
All four answer options for each question must be similar in length and grammatical complexity. Do not let the correct answer stand out by being noticeably longer, more detailed, or more qualified than the others. A reader should not be able to guess the answer from its length or structure alone.`;

  const data = await callChat({
    model: "o4-mini",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });
  return JSON.parse(data.choices[0].message.content) as Exercise;
}

export function useGenerateReading() {
  return useMutation({
    mutationFn: ({ language, difficulty }: { language: string; difficulty: number }) =>
      fetchExercise(language, difficulty),
  });
}
