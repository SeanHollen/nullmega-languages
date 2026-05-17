import { callGrammar } from "./api";
import type { GrammarCategory, QuizQuestion } from "./grammarCards";
import { pickClosest } from "./proximity";

export interface RawGrammarCard {
  title: string;
  prompt: string;
  category: GrammarCategory;
  questions: QuizQuestion[];
}

const LEVEL_DESCRIPTIONS: Record<number, string> = {
  1: `absolute beginner — present tense only, simplest vocabulary, basic affirmative sentences`,
  2: `beginner — present tense variations, basic negation, simple questions`,
  3: `beginner-intermediate — past tense basics, common irregular verbs, simple connectives`,
  4: `elementary — past and future basics, negation, simple questions, basic pronouns`,
  5: `lower-intermediate — multiple tenses, articles, prepositions, moderate sentence length`,
  6: `intermediate — subjunctive basics, conditional, relative clauses, complex sentences`,
  7: `upper-intermediate — nuanced tense usage, passive constructions, idiomatic phrases`,
  8: `advanced — nuanced tenses, idiomatic structures, formal/informal register distinctions`,
  9: `proficient — rare constructions, advanced register, complex subordination, stylistics`,
  10: `expert — literary forms, archaic usage, advanced stylistics, subtle grammatical nuance`,
};

export async function generateGrammarCards(params: {
  language: string;
  level: number;
  count: number;
  existingCards: { title: string; level: number }[];
}): Promise<RawGrammarCard[]> {
  const { language, level, count, existingCards } = params;
  const safeLevel = Math.max(1, Math.min(10, level));
  const levelDesc = LEVEL_DESCRIPTIONS[safeLevel];

  const prioritised = pickClosest(existingCards, (c) => c.level, safeLevel, 500).map(
    (c) => c.title,
  );

  const avoidNote =
    prioritised.length > 0
      ? `\n\nAvoid redundancy with these previously generated quiz titles:\n${prioritised.join(`, `)}`
      : ``;

  const prompt = `Generate ${count} grammar quiz card${count === 1 ? `` : `s`} for a ${language} learner at difficulty level ${safeLevel}/10 (${levelDesc}).

Each card tests one specific grammar concept. Include a mix of these categories:
- tense-conjugation: verb tenses, conjugation rules and patterns
- word-order: sentence structure, clause ordering, constituent placement
- parts-of-speech: nouns, adjectives, pronouns, prepositions, articles
- misc: register and formality, honorifics and addressee deference (e.g. tu/vous, du/Sie, Japanese keigo, Korean speech levels), politeness strategies (hedging, softening, indirectness), idioms and set phrases, wordplay and humor (puns, irony, register-mismatch jokes), discourse markers and fillers, sociolinguistic conventions, regional/dialectal variation, connotation, punctuation, orthography, common learner errors, and any other ${language}-specific feature not covered by the categories above

Scale topic choice to the level. Up to level ~5, stay grounded in core grammar (the first three categories). From level ~6 upward, increasingly weight the misc category, and connotation become essential at advanced levels. Only generate honorifics/keigo-style cards for languages that actually have such systems.

Card structure:
- title: 2-10 words naming the concept (e.g. "Passé Composé vs Imparfait", "Adjective Agreement with Gender")
- prompt: 5-40 words describing what the quiz tests
- category: one of "tense-conjugation", "word-order", "parts-of-speech", "misc"
- questions: 1-8 questions, each either:
  - multiple-choice: {"type":"multiple-choice","prompt":"...","choices":["a","b","c","d"],"answer":"exact text of correct choice"}
  - write-in: {"type":"write-in","prompt":"Fill in: Je ___ (aller) au marché hier.","answer":"suis allé"}

Rules:
- Every question must have exactly one unambiguous correct answer
- Use real ${language} examples in questions
- Write-in answers should be 1-4 words and unambiguous
- Multiple-choice distractors should be plausible but clearly wrong
- For tense-conjugation cards, strongly prefer write-in questions — use multiple-choice only when the answer would be genuinely ambiguous as a free-form fill-in
- Do NOT mix question types for the sake of variety; choose the type that best fits each question${avoidNote}

Return ONLY valid JSON:
{"cards":[{"title":"...","prompt":"...","category":"...","questions":[...]}]}`;

  const data = await callGrammar({
    model: `o4-mini`,
    messages: [
      {
        role: `system`,
        content: `You generate grammar quiz cards for language learners. Card titles must be descriptive and specific — name the exact construction or rule being tested (e.g. "Passé Composé with avoir: irregular past participles" rather than "Past Tense Practice"). Titles should be concise but informative, typically 4–10 words.`,
      },
      { role: `user`, content: prompt },
    ],
    response_format: { type: `json_object` },
  });

  const content = data.choices[0]?.message?.content ?? ``;
  const parsed = JSON.parse(content) as { cards?: RawGrammarCard[] };
  return (parsed.cards ?? []).slice(0, count);
}
