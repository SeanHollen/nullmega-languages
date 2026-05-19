import { useMutation } from "@tanstack/react-query";
import type { Exercise, ExerciseLlmResponse } from "../types";
import { callChat } from "../utils/api";
import { getUserId } from "../utils/user";
import { getTitlesByComplexity } from "../utils/history";
import { referenceBlocks } from "../utils/levelReferences";

function passageLengthGuide(languageComplexity: number): string {
  if (languageComplexity <= 15)
    return "100-150 words. At this level, achieve length through simple conversations, repetitive sentence structures, lists of objects or actions, or labelled descriptions — not by using complex vocabulary or grammar";
  if (languageComplexity <= 30)
    return "120-170 words. Use dialogue, simple narratives with repeated patterns, or descriptive lists to fill the length while keeping language elementary";
  if (languageComplexity <= 50) return "140-200 words";
  return "160-220 words";
}

async function fetchExercise(
  language: string,
  languageComplexity: number,
  mode: "reading" | "listening",
): Promise<Exercise> {
  const referenceBlock = `Difficulty references (based on English examples — these illustrate the difficulty gradient, not the topic):
${referenceBlocks(languageComplexity, { includeQuestion: true })}

Match the difficulty of the target level. The topic and content of your passage should be chosen independently — do not anchor on the topics in the examples above.`;

  const nearbyTitles = await getTitlesByComplexity(mode, language, languageComplexity, 500);
  const avoidanceBlock =
    nearbyTitles.length > 0
      ? `\n\nPAST TOPICS at similar complexity (do not repeat any of these or cover closely related ground — choose something fresh):
${nearbyTitles.map((t) => `- ${t}`).join("\n")}`
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

  const prompt = `Generate a reading comprehension exercise in ${language} at difficulty ${languageComplexity}/100.

${referenceBlock}${avoidanceBlock}${narrativeBlock}

Return ONLY valid JSON with this exact shape:
{
  "title": "3-6 word title in ${language} describing the topic of the passage",
  "passage": "${passageLengthGuide(languageComplexity)} passage entirely in ${language}",
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
Before writing each question, apply this test: "Could someone answer this correctly by searching for the question's key noun or verb in the passage and picking the option whose words appear nearby?" If yes, rewrite it. Specifically:
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
    metadata: { mode, language, difficulty: languageComplexity, userId: await getUserId() },
  });
  const parsed = JSON.parse(data.choices[0].message.content) as ExerciseLlmResponse;
  return { ...parsed, languageComplexity };
}

export function useGenerateReading() {
  return useMutation({
    mutationFn: ({
      language,
      languageComplexity,
      mode = "reading",
    }: {
      language: string;
      languageComplexity: number;
      mode?: "reading" | "listening";
    }) => fetchExercise(language, languageComplexity, mode),
  });
}
