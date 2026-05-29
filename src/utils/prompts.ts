// Centralised LLM prompt strings. Every prompt sent to a chat model in the app is
// built here, so the wording can be reviewed in one place.

import { referenceBlocks } from "./levelReferences";
import type { NarratorGender, ReadingLength } from "../types";

export type { ReadingLength };

// ---------- Shared helpers ----------

function pastTitlesBlock(label: string, titles: string[]): string {
  if (titles.length === 0) return ``;
  return `\n\n${label} — AVOID these topics. They are NOT a style template; pick a different format if these are mostly one kind.
${titles.map((t) => `- ${t}`).join(`\n`)}`;
}

const NARRATIVE_BLOCK = `

FORMAT VARIETY (important):
Vary the format aggressively. Do NOT default to first-person personal narrative. Pick from a wide range, e.g.: two-person dialogue, magazine excerpt, news brief, instructional howto, recipe with commentary, journal entry, advice column, sci-fi vignette, fantasy fragment, historical letter, technical writeup, product review, museum placard, podcast transcript snippet, lyric or poem fragment, overheard conversation, customer-service exchange, scientific abstract. Don't get overly experimental for the sake of it, but when looking at previuos summaries, try to include (level-appropriate) formats which are underrepresented.

QUALITY: give the reader a reason to keep reading. Aim for at least one of:
- A narrative arc (setup → complication → resolution or twist)
- A controversy, conflict, or contrasting perspectives
- A callback, parallel, or unexpected turn that pays something off
- A concrete insight or specific detail that earns its place
FLOW: each sentence must follow from the previous one — causation, consequence, contrast, or argument. No arbitrary lists, no recitations of unrelated facts strung together to hit a word count or showcase vocabulary.
Avoid: bland filler, "When I was X, now I Y" arcs, "It was a great experience!" framing.
`;

// ---------- Reading / Listening exercise ----------

const READING_LENGTH_MULTIPLIER: Record<ReadingLength, number> = {
  short: 1 / 3,
  medium: 1,
  long: 3,
};

function readingPassageBaseRange(languageComplexity: number): {
  min: number;
  max: number;
  extra: string;
} {
  if (languageComplexity <= 15)
    return {
      min: 100,
      max: 150,
      extra: `At this level, achieve length through simple conversations, repetitive sentence structures, lists of objects or actions, or labelled descriptions — not by using complex vocabulary or grammar`,
    };
  if (languageComplexity <= 30)
    return {
      min: 120,
      max: 170,
      extra: `Use dialogue, simple narratives with repeated patterns, or descriptive lists to fill the length while keeping language elementary`,
    };
  if (languageComplexity <= 50) return { min: 140, max: 200, extra: `` };
  return { min: 160, max: 220, extra: `` };
}

function readingPassageLengthGuide(languageComplexity: number, length: ReadingLength): string {
  const { min, max, extra } = readingPassageBaseRange(languageComplexity);
  const m = READING_LENGTH_MULTIPLIER[length];
  const scaledMin = Math.round((min * m) / 10) * 10;
  const scaledMax = Math.round((max * m) / 10) * 10;
  return extra ? `${scaledMin}-${scaledMax} words. ${extra}` : `${scaledMin}-${scaledMax} words`;
}

export function buildReadingExercisePrompt(args: {
  language: string;
  languageComplexity: number;
  length: ReadingLength;
  pastSummaries: string[];
  narratorGender: NarratorGender;
}): string {
  const { language, languageComplexity, length, pastSummaries, narratorGender } = args;
  const referenceBlock = `Difficulty references (English examples for calibration ONLY):
${referenceBlocks(languageComplexity, { includeQuestion: true })}

The ONLY purpose of these examples is to show you the vocabulary band and sentence complexity appropriate at the target level. Many different valid passages exist at any difficulty.
DO NOT copy from the examples: their themes, narrative shapes, protagonists, settings, openings, rhetorical strategies, or grammatical constructions. If the examples all use a particular tense or sentence pattern, that does NOT mean your passage should — it means the writer of those examples happened to pick that. Choose your own subject and structure freely.`;
  const avoidanceBlock = pastTitlesBlock(`PAST PASSAGE SUMMARIES`, pastSummaries);

  return `Generate a reading comprehension exercise in ${language} at difficulty ${languageComplexity}/100.

Narrator: ${narratorGender}

${referenceBlock}${avoidanceBlock}${NARRATIVE_BLOCK}

Return ONLY valid JSON with this exact shape (write the fields in this order — summary is LAST so you fill it in after the passage is fully drafted):
{
  "title": "3-6 word title in ${language} describing the topic of the passage",
  "passage": "${readingPassageLengthGuide(languageComplexity, length)} passage entirely in ${language}",
  "difficultWords": ["word in ${language}", "..."],
  "properNouns": [{ "name": "proper noun as it appears in the passage", "description": "1-5 word gloss in ${language} (NOT a translation)" }],
  "insight": "1-2 sentences in ${language} noting something genuinely interesting about the passage — an unusual grammatical construction, a subtle idiomatic choice, a register shift, or a structural feature worth a learner's attention. Scale depth to the difficulty level.",
  "questions": [
    {
      "question": "question in ${language}",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correct": 0
    },
    "... 3-6 questions total ..."
  ],
  "summary": "one grammatically correct English sentence written after the passage is finished. State, plainly and literally, the key concrete objects, places, people, and themes that appear, plus enough plot nuance to make this passage distinguishable from others on the same topic. No flourish, no metaphor, no poetic framing — describe what is, not how it feels. Example: 'A grandmother teaches her granddaughter to bake bread in a village kitchen, and the granddaughter ruins the first loaf by adding salt instead of sugar before getting it right on the second try.'"
}

- Generate 3 to 6 questions, scaled to passage length — shorter passages get 3, longer ones up to 6. All text in ${language}.
- "correct" is the 0-based index of the correct answer

DIFFICULT WORDS — what to include:
- Words important for understanding the rest of the passage. If the reader doesn't need to know the word, don't include it.
- Words with idiomatic, register-specific, or unexpected meanings in context.
- Scale to the difficulty level: at low levels even a few opaque words count; at high levels include subtler vocabulary.
- Include about 2-4 words, sometimes 1-5

PROPER NOUNS:
- List every proper noun in the passage (people, places, organizations, fictional entities).
- "description" is a 1–5 word gloss IN ${language}, not a translation. e.g. for "Sétif" → "ville d'Algérie".
- Empty array if none.

THE COMMAND-F TEST:
A learner must NOT be able to answer any question by Ctrl-F searching the passage for a keyword from the question or the correct option. For every question you write, mentally do this:
1. Pick the most distinctive noun, verb, or adjective in the QUESTION. Search the passage for that word (and its obvious morphological variants — plural/singular, conjugations, gender forms). If you find it, the question is too easy to look up — rewrite the question using a paraphrase or synonym not found in the passage.
2. Pick the most distinctive content word in the CORRECT OPTION. Search the passage for it. If it appears verbatim in the passage, the option is a giveaway — rewrite the correct option to paraphrase the underlying meaning using different vocabulary.
3. Now check the WRONG OPTIONS: their distinctive content words should ALSO not appear verbatim, OR they should appear in the passage in ways that make them plausible-but-wrong (e.g. true statements that don't actually answer the question, near-correct conclusions that fail on a subtle point). What you must avoid: only the correct option's keywords appearing in the passage. That is pure lookup.

Concretely:
- BAD: Passage says "She walked to the bakery and bought bread." Q: "Where did she go?" Correct: "To the bakery." (lookup wins — both "bakery" appears verbatim)
- GOOD: Same passage. Q: "What was her errand?" Correct: "Buying groceries." (paraphrased — no shared keyword)

Additional rules:
- Wrong options must be plausible: either true statements from the passage that don't actually answer the question, or near-correct conclusions that fail on a subtle point
- Require inference, logical conclusion, understanding of word meaning in context, or recognition of tone/intent — not recall.
- Questions should be about meaning and understanding, not grammar.
- A question or two can be more direct at the lowest difficulty levels, but even then the answer should require understanding, not matching.

ANSWER OPTION LENGTH:
All four answer options for each question must be similar in length and grammatical complexity. Do not let the correct answer stand out by being noticeably longer, more detailed, or more qualified than the others. A reader should not be able to guess the answer from its length or structure alone.`;
}

// ---------- Writing exercise ----------

function writingPassageLengthGuide(languageComplexity: number): string {
  if (languageComplexity <= 15) return `100-150 words`;
  if (languageComplexity <= 30) return `120-170 words`;
  if (languageComplexity <= 50) return `140-200 words`;
  return `160-220 words`;
}

// Dictogloss passages are read aloud — we target ~N seconds of audio at level N.
// Roughly 2.5 spoken words per second, so target words ≈ 2.5 × complexity.
// e.g. level 20 → ~50 words (~20 s); level 50 → ~125 words (~50 s); level 100 → ~250 words.
function dictoglossPassageLengthGuide(languageComplexity: number): string {
  const target = Math.max(10, Math.round(languageComplexity * 2.5));
  const min = Math.max(5, roundTo5(Math.round(target * 0.85)));
  const max = roundTo5(Math.round(target * 1.15));
  return `${min}-${max} words (passage will be read aloud — aim for roughly ${languageComplexity} seconds of speech)`;
}

function passageWordsFor(languageComplexity: number): number {
  if (languageComplexity <= 15) return 125;
  if (languageComplexity <= 30) return 145;
  if (languageComplexity <= 50) return 170;
  if (languageComplexity <= 75) return 185;
  return 200;
}

function roundTo5(n: number): number {
  return Math.round(n / 5) * 5;
}

export function essayWordCounts(languageComplexity: number): { min: number; max: number } {
  const target = Math.max(
    15,
    Math.round((languageComplexity / 100) * passageWordsFor(languageComplexity)),
  );
  return { min: roundTo5(Math.round(target * 0.8)), max: roundTo5(Math.round(target * 1.3)) };
}

export function buildWritingExercisePrompt(args: {
  language: string;
  languageComplexity: number;
  mode: "short-answer" | "dictogloss";
  pastSummaries: string[];
}): string {
  const { language, languageComplexity, mode, pastSummaries } = args;
  const { min, max } = essayWordCounts(languageComplexity);
  const passageGuide =
    mode === `dictogloss`
      ? dictoglossPassageLengthGuide(languageComplexity)
      : writingPassageLengthGuide(languageComplexity);
  const referenceBlock = `Difficulty references (English examples for calibration ONLY):
${referenceBlocks(languageComplexity)}

The ONLY purpose of these examples is to show you the vocabulary band and sentence complexity appropriate at the target level. Many different valid passages exist at any difficulty.
DO NOT copy from the examples: their themes, narrative shapes, protagonists, settings, openings, rhetorical strategies, or grammatical constructions. Choose your own subject and structure freely.`;
  const avoidanceBlock = pastTitlesBlock(`PAST PASSAGE SUMMARIES`, pastSummaries);

  return `Generate a writing exercise in ${language} at difficulty ${languageComplexity}/100.

${referenceBlock}${avoidanceBlock}${NARRATIVE_BLOCK}

Return ONLY valid JSON with this exact shape (write the fields in this order — summary is LAST so you fill it in after the passage is fully drafted):
{
  "title": "3-6 word title in ${language} describing the topic of the passage",
  "passage": "${passageGuide} passage entirely in ${language}",
  "difficultWords": ["word in ${language}", "..."],
  "insight": "1-2 sentences in ${language} noting something interesting about the language used in the passage",
  "questions": [
    { "type": "short", "question": "short-answer question in ${language} — answer should fit in one brief phrase or sentence" },
    { "type": "short", "question": "another short-answer question in ${language} — answer should fit in one brief phrase or sentence" },
    { "type": "essay", "question": "essay prompt in ${language} asking for a ${min}–${max} word response related to the passage theme" }
  ],
  "summary": "one grammatically correct English sentence written after the passage is finished. State, plainly and literally, the key concrete objects, places, people, and themes that appear, plus enough plot nuance to make this passage distinguishable from others on the same topic. No flourish, no metaphor, no poetic framing — describe what is, not how it feels."
}

SHORT-ANSWER QUESTIONS: test specific comprehension; require understanding, not just copying words.
ESSAY QUESTION: at low levels use simple prompts (describe your own experience with the topic); at high levels use analytical or argumentative prompts.
DIFFICULT WORDS: include words with idiomatic, register-specific, or unexpected meanings in context.`;
}

// ---------- Writing grader ----------

export interface GraderQuestion {
  type: "short" | "essay";
  question: string;
  answer: string;
  minWords?: number;
  maxWords?: number;
}

export function buildWritingGraderPrompt(args: {
  language: string;
  languageComplexity: number;
  passage: string;
  questions: GraderQuestion[];
}): string {
  const { language, languageComplexity, passage, questions } = args;
  const questionBlock = questions
    .map((q, i) => {
      const typeLabel =
        q.type === `essay` ? `essay (${q.minWords}–${q.maxWords} words required)` : `short answer`;
      return `Question ${i + 1} (${typeLabel}): ${q.question}\nStudent's answer: "${q.answer}"`;
    })
    .join(`\n\n`);

  return `You are grading a ${language} writing exercise at difficulty ${languageComplexity}/100.

Passage the student read:
"${passage}"

${questionBlock}

Grade each answer from 1–5:
5 = Excellent — correct, natural ${language}, good vocabulary
4 = Good — minor errors that don't impede understanding
3 = Adequate — some errors but meaning is clear
2 = Poor — significant errors that impede understanding
1 = Very poor — mostly incorrect, incomprehensible, or blank

Return ONLY valid JSON with EXACTLY ${questions.length} grade${questions.length === 1 ? `` : `s`} (one per question, in the same order):
{
  "grades": [
${questions.map(() => `    { "score": 1-5, "notes": "..." }`).join(`,\n`)}
  ]
}

For "notes": list only concrete corrections in the form "wrong → correct" (e.g. "hiver → l'hiver", "j'aime jouer → j'aime jouer au foot"). Separate multiple corrections with ", ". If the answer is perfect, write "✓". Do not write prose descriptions — only corrections. For essay answers, if the word count was not met also prepend e.g. "Word count: 18/25 minimum. " before the corrections.`;
}

// ---------- Vocab paragraph grader ----------

export function buildVocabParagraphGraderPrompt(args: {
  language: string;
  languageComplexity: number;
  requiredWords: { source: string; translation: string }[];
  paragraph: string;
  nativeLanguage: string;
}): string {
  const { language, languageComplexity, requiredWords, paragraph, nativeLanguage } = args;
  const wordList = requiredWords
    .map((w) => `- ${w.source} (${nativeLanguage}: ${w.translation})`)
    .join(`\n`);

  return `You are grading a ${language} paragraph written by a student at difficulty ${languageComplexity}/100.

The student was asked to write one paragraph that incorporates ALL of the following vocabulary words. Inflected forms are acceptable (e.g. plural, conjugated, gendered) — what matters is that the word's root meaning is used.

Required vocabulary:
${wordList}

Student's paragraph:
"${paragraph}"

Score from 1–5 reflecting BOTH:
1. Coverage — did the student use all required words correctly and in context?
2. Writing quality — grammar, naturalness, vocabulary variety, coherence in ${language}.

5 = Excellent — used every word naturally and correctly; well-written ${language}
4 = Good — minor issues; one or two words awkward but used; otherwise solid
3 = Adequate — most words used but with notable errors, OR all words used but writing is rough
2 = Poor — missed words or significant errors that impede meaning
1 = Very poor — most words unused or paragraph is incoherent

Return ONLY valid JSON with EXACTLY one grade:
{
  "grades": [
    { "score": 1-5, "notes": "..." }
  ]
}

For "notes": list which required words were missing (if any), then concrete corrections in the form "wrong → correct" (e.g. "hiver → l'hiver"). Separate with ", ". If perfect, write "✓". Don't write prose; only word-misses and corrections.`;
}

// ---------- Pronunciation exercise ----------

function pronunciationPhraseCount(languageComplexity: number): number {
  if (languageComplexity <= 25) return 3;
  if (languageComplexity <= 50) return 4;
  if (languageComplexity <= 75) return 5;
  return 6;
}

function pronunciationPhraseLengthGuide(languageComplexity: number): string {
  if (languageComplexity <= 20)
    return `3-6 words each. Use very common vocabulary and basic everyday phrases`;
  if (languageComplexity <= 40)
    return `5-10 words each. Use common vocabulary with some variety in tense and structure`;
  if (languageComplexity <= 60)
    return `8-15 words each. Include varied grammar, some idioms, and moderately challenging vocabulary`;
  if (languageComplexity <= 80)
    return `12-20 words each. Use complex sentence structures, idiomatic language, and nuanced vocabulary`;
  return `15-25 words each. Include sophisticated idioms, complex grammar, and advanced vocabulary`;
}

export function buildPronunciationExercisePrompt(args: {
  language: string;
  languageComplexity: number;
  pastTitles: string[];
}): string {
  const { language, languageComplexity, pastTitles } = args;
  const count = pronunciationPhraseCount(languageComplexity);
  const avoidanceBlock = pastTitlesBlock(`PAST THEMES at similar complexity`, pastTitles);

  return `Generate a pronunciation practice exercise in ${language} at difficulty ${languageComplexity}/100.

THEME: All ${count} phrases must belong to a single coherent topic or theme summarised by the title (e.g. "ordering at a café", "moving day", "weather complaints", "phone call with a friend"). Do not produce a grab-bag of unrelated sentences.

Return ONLY valid JSON with this exact shape:
{
  "title": "3-6 word title in ${language} describing the theme tying the phrases together",
  "phrases": ["phrase in ${language}", "..."]
}

- Generate exactly ${count} phrases, all within the chosen theme
- Phrases should be ${pronunciationPhraseLengthGuide(languageComplexity)}
- Within the theme, vary the type: statements, questions, exclamations
- Phrases should be practical and natural-sounding in ${language}
- At low difficulty: prioritise common sounds and basic patterns; at high difficulty: include challenging phoneme combinations, intonation shifts, and less common vocabulary${avoidanceBlock}`;
}

// ---------- Flashcard contexts ----------

export function buildContextsPrompt(args: {
  language: string;
  word: string;
  translation: string;
  includeTranslation: boolean;
  count: number;
  nativeLanguage: string;
}): string {
  const { language, word, translation, includeTranslation, count, nativeLanguage } = args;
  const meaningClause = includeTranslation ? ` (${nativeLanguage} meaning: "${translation}")` : ``;
  return `Generate ${count} short example contexts for the ${language} word/phrase "${word}"${meaningClause}.

Each context is a short sentence or fragment in ${language} (5-15 words) that uses a form of "${word}".

Requirements:
- The ${language} context must use "${word}" (you may vary tense, gender, plurality, conjugation; for multi-word phrases keep the phrase together).
- In the ${language} context, wrap the exact form of "${word}" that appears with double asterisks: **like this**. Wrap only the word/phrase itself, not surrounding punctuation.
- In the ${nativeLanguage} translation, wrap the ${nativeLanguage} equivalent of "${word}" (whatever inflected form fits naturally) with double asterisks too.
- "${word}" should be the most complex/difficult element of the context. Surround it with simpler, common vocabulary. These are "n+1 cards".
- The context should make sense and stay true to the word's meaning, but should NOT give away the translation directly (no glosses, no synonyms in parentheses).
- Each context should use the word differently — vary the tense, register, situation, or sentence structure. Aim for genuine variety.

Return ONLY valid JSON of this exact shape:
{
  "contexts": [
    { "source": "<${language} context containing **${word}** (or an inflected form)>", "translation": "<${nativeLanguage} translation containing **the ${nativeLanguage} equivalent**>" }
  ]
}`;
}

// ---------- Grammar quiz cards ----------

const GRAMMAR_LEVEL_DESCRIPTIONS: Record<number, string> = {
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

export const GRAMMAR_CARDS_SYSTEM_MESSAGE = `You generate grammar quiz cards for language learners. Card titles must be as narrow and specific as possible — ideally pinned to a particular lexical item (verb, preposition, particle, idiom, etc.) rather than a whole grammatical class. Examples of GOOD titles: "Present-tense conjugation of 'aller'", "Subjunctive after 'pour que'", "Avoir vs être as auxiliary in passé composé". Examples of BAD titles (too broad — do not use these): "Present Conjugation of -er Verbs", "Past Tense Practice", "Adjective Agreement". Only fall back to a broader title when the concept genuinely cannot be tied to a specific word (e.g. a sentence-structure rule). Titles should be concise but informative, typically 4–10 words.`;

export function buildGrammarCardsPrompt(args: {
  language: string;
  level: number;
  count: number;
  pastTitles: string[];
}): string {
  const { language, level, count, pastTitles } = args;
  const safeLevel = Math.max(10, Math.min(100, level));
  const bucket = Math.max(1, Math.min(10, Math.round(safeLevel / 10)));
  const levelDesc = GRAMMAR_LEVEL_DESCRIPTIONS[bucket];

  const avoidNote =
    pastTitles.length > 0
      ? `\n\nAvoid redundancy with these previously generated quiz titles:\n${pastTitles.join(`, `)}`
      : ``;

  return `Generate ${count} grammar quiz card${count === 1 ? `` : `s`} for a ${language} learner at difficulty level ${safeLevel}/100 (${levelDesc}).

Each card tests one specific grammar concept. Include a mix of topics:
- tense / conjugation: verb tenses, conjugation rules and patterns
- word order: sentence structure, clause ordering, constituent placement
- parts of speech: nouns, adjectives, pronouns, prepositions, articles
- misc: register and formality, honorifics and addressee deference (e.g. tu/vous, du/Sie, Japanese keigo, Korean speech levels), politeness strategies (hedging, softening, indirectness), idioms and set phrases, wordplay and humor (puns, irony, register-mismatch jokes), discourse markers and fillers, sociolinguistic conventions, regional/dialectal variation, connotation, punctuation, orthography, common learner errors, and any other ${language}-specific feature

Scale topic choice to the level. Up to level ~50, stay grounded in core grammar (tense, word order, parts of speech). From level ~60 upward, weight misc/register/connotation topics more. Only generate honorifics/keigo-style cards for languages that actually have such systems.

Card structure:
- title: 2-10 words naming the concept. Pin to a specific word when possible (e.g. "Present-tense conjugation of 'aller'", "Gender agreement of 'beau'/'belle'", "Subjunctive after 'pour que'"). Avoid broad titles like "-er verbs", "irregular verbs", "past tense" — pick a specific verb/word/construction and test that.
- prompt: 5-40 words describing what the quiz tests
- tags: an array of 1-4 short lowercase tags describing what the card is about. Use established tags when applicable (e.g. "tense", "conjugation", "word-order", "register", "idiom", "preposition", "subjunctive", "passive"). Add a language-specific tag if relevant (e.g. "keigo" for Japanese honorifics). Don't pluralize. Don't include the language name itself as a tag.
- questions: 1-8 questions, each either:
  - multiple-choice: {"type":"multiple-choice","prompt":"...","choices":["a","b","c","d"],"answer":"exact text of correct choice","shuffle":true}
  - write-in: {"type":"write-in","prompt":"Fill in: Je ___ (aller) au marché hier.","answer":["suis allé"],"example":"Hier, elle **est allée** au cinéma."}

Rules:
- Monolingual: card prompt and every question prompt/answer must be written entirely in ${language}. Do not use English (or any other non-target language) anywhere in the card content.
- If the question relies on a grammar term (e.g. "imparfait du subjonctif"), an "example" field is REQUIRED so a native speaker who doesn't know the term can still answer.
- Use real ${language} examples in questions
- Write-in answers should be 1-4 words
- For write-in, "answer" must be an ARRAY of all acceptable answers. The FIRST element must be the canonical / recommended form (this is what gets shown to the user when they get it wrong). Subsequent elements are alternates that should still be marked correct: with/without a clitic that sits adjacent to the blank in the prompt (e.g. ["aimes-tu","aimes"]), spelling variants, alternate verb forms when both are valid in context, etc. If the answer is genuinely unambiguous, the array has a single element.
- Multiple-choice "answer" is a single string (the exact text of the correct choice). Distractors should be plausible but clearly wrong.
- Prefer write-in for conjugation / inflection / vocabulary questions where the lemma or stem is given in the prompt and showing the options would spoil the answer.
- Prefer multiple-choice for structural / abstract questions where many forms could plausibly fit (subjunctive selection, particle choice, register pickers, agreement). If no obvious cue tells the learner which form is wanted, use multiple-choice.
- "example" (write-in only): one short sentence in ${language} demonstrating the same construction, with the part corresponding to the answer wrapped in **double asterisks**. Required whenever the prompt uses a grammatical term — a native speaker who doesn't know the term must still be able to answer from the example. Optional only when the prompt is fully self-evident.
- Do NOT mix question types for the sake of variety; choose the type that best fits each question${avoidNote}

Return ONLY valid JSON:
{"cards":[{"title":"...","prompt":"...","tags":["..."],"questions":[...]}]}`;
}
