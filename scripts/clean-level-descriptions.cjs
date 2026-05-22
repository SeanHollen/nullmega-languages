/* eslint-disable */
// One-shot: rewrites every "description" in difficulty-levels.json so each describes
// only language complexity — CEFR level, study duration, vocabulary count, grammar
// features, sentence structure, register, stylistic difficulty — and never locks the
// passage to a specific topic, subject, or domain (food, hobbies, science, etc.).
// Examples are kept untouched.

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "src", "data", "difficulty-levels.json");

const descriptions = {
  1: "Pre-A1. Day 1. Isolated single words only — basic concrete nouns and simple greetings. No grammar, no sentences. Vocabulary 10–20 core words.",
  2: "Pre-A1. Day 1–2. Single words and very simple two-word phrases. Vocabulary near 20–25 words. No verbs except an implicit 'is.'",
  3: "Pre-A1. Day 2–3. Two- to three-word phrases. Vocabulary near 30 words. Subject-verb constructions at the most basic level.",
  4: "Pre-A1. Day 3–5. Very short sentences with 'is' and 'are.' Subject + verb + noun with a single adjective. Vocabulary near 40 words. Present tense only.",
  5: "Pre-A1. First week. Simple declarative sentences using 'I have,' 'I like,' 'I see.' Vocabulary roughly 50 common words. No negation, no questions.",
  6: "Pre-A1. Week 1–2. Simple negation ('I do not have,' 'It is not big'). Adds 'this/that.' Vocabulary near 60 words. Still declarative; no questions.",
  7: "A1 entry. First week. Yes/no questions and short answers. Vocabulary near 75 words. Sentences 4–6 words. Present tense with common high-frequency verbs.",
  8: "A1 entry. Days 7–10. Short question-answer exchanges. Possessives (my, your, his, her) and simple plurals. Vocabulary near 100 words.",
  9: "A1 entry. Second week. Present continuous introduced. Vocabulary near 125 words. Sentences remain very short but now depict ongoing actions.",
  10: "A1 entry. Weeks 2–3. Negation with 'don't' and basic 'where' questions. Prepositions of place. Vocabulary near 150 words.",
  11: "A1 entry. Third week. 'There is / there are' and 'how many' questions. Numbers up to 20. Vocabulary near 175 words. One clause per sentence.",
  12: "A1. Weeks 3–4. Basic time expressions (today, tomorrow, yesterday). Vocabulary near 200 words. Two or three closely related sentences.",
  13: "A1. Week 4. Telling time. Numbers up to 100. Basic ordinals (first, second, third). Question words 'when' and 'what time.' Vocabulary near 225 words.",
  14: "A1. End of first month. Simple past tense introduced with regular verbs ('walked,' 'talked'). Vocabulary near 275 words. Two or three simple past-tense sentences.",
  15: "A1. End of first month. Simple past regular verbs paired with time markers ('yesterday morning,' 'last night'). Vocabulary near 300 words. Two or three connected past-tense sentences.",
  16: "A1. Month 1, weeks 3–4. Irregular past tense verbs (went, saw, had, ate). 'And' and 'but' connect two clauses. Vocabulary near 325 words.",
  17: "A1. End of first month. 'And,' 'but,' and 'because' link clauses. Past and present tenses mixed. Vocabulary near 375 words. Sentences are short, concrete, and personal.",
  18: "A1. Month 2. Simple future with 'will' and 'going to.' Vocabulary near 425 words. Short, concrete paragraphs.",
  19: "A1. Month 2. Basic descriptive adjectives. Simple comparatives (bigger, faster). Vocabulary near 475 words. Very short descriptive passages.",
  20: "A1. Month 2. Imperatives and commands appear. Vocabulary near 525 words. Short functional sentences.",
  21: "A1. Month 2–3. Numbers, quantities, and prices used in short functional exchanges. Vocabulary near 575 words.",
  22: "A1. Month 3. Modal 'can' for ability introduced. Vocabulary near 625 words. Short descriptive passages with one or two simple clauses.",
  23: "A1. Month 3. Modal 'would like' for polite requests. Vocabulary around 675 words. Short scenes with one or two characters and simple dialogue.",
  24: "A1. Month 3. Time-of-day expressions ('at seven o'clock,' 'in the afternoon,' 'after work'). Vocabulary around 700 words. Short connected paragraphs.",
  25: "A1. Month 3. Frequency adverbs (always, sometimes, never, often). Simple sentences about preferences and habits. Vocabulary near 725 words.",
  26: "A1. Month 3–4. Simple relative clauses with 'that' or 'which.' 'There is/are' with more detail. Vocabulary around 775 words.",
  27: "A1. Month 4. Modal 'should' introduced. Present and past tense mixed in short narrative. Vocabulary near 825 words.",
  28: "A1. End of month 4. Short personal narrative combining present, past, and simple future. Vocabulary around 875 words. Sentences have one or two clauses; content remains concrete.",
  29: "A2. Month 4–5. Compound sentences with 'and,' 'but,' 'so,' 'because.' Time connectors (first, then, after that). Vocabulary around 1,000 words.",
  30: "A2. Month 5. Comparatives and superlatives. Vocabulary near 1,100 words. Two or three sentences using comparative structures.",
  31: "A2. Month 5. Present perfect introduced ('have you ever') for experience. Vocabulary around 1,200 words. Short personal anecdotes.",
  32: "A2. Month 5–6. 'Used to' for habitual past action. Vocabulary near 1,300 words.",
  33: "A2. Month 6. 'Used to' paired with the present tense, with reasons and consequences ('I used to … because …'). Vocabulary near 1,350 words.",
  34: "A2. Month 6. Informal register — greetings, closings, conversational tone. Vocabulary around 1,400 words.",
  35: "A2. Month 6–7. Short connected paragraph with a clear beginning, middle, and end. Past-tense narration with adverbial detail. Vocabulary near 1,500 words.",
  36: "A2. Month 7. Opinion markers: 'I think that,' 'In my opinion,' 'I agree/disagree.' Vocabulary around 1,600 words. A short paragraph stating and supporting a position.",
  37: "A2. Month 7–8. Conditionals type 1 ('If it rains, I will stay home'). Vocabulary near 1,700 words. Short practical paragraphs.",
  38: "A2. Month 8. Sequence markers and imperatives in an instructional register. Vocabulary around 1,800 words.",
  39: "A2. End of month 9. Connected paragraph spanning past, present, and future, with comparatives, simple conditionals, and basic conjunctions. Vocabulary around 2,000 words. Short to medium sentences.",
  40: "B1 entry. Month 9–10. Paragraphs with multiple clauses, subordination, and embedded phrases. Vocabulary near 2,200 words.",
  41: "B1 entry. Month 10. Concessive clauses ('although,' 'even though,' 'however') used to hold two perspectives in balance. Vocabulary near 2,400 words.",
  42: "B1. Month 10. Causal connectives ('because of,' 'as a result,' 'consequently'). One factor traced to another over multiple steps. Vocabulary near 2,500 words.",
  43: "B1 entry. Month 10–11. Past perfect introduced ('had left,' 'had forgotten'). More complex sequencing in past-tense passages. Vocabulary around 2,600 words.",
  44: "B1 entry. Month 11. Vocabulary for inner life (relieved, frustrated, anxious, content). More nuanced adjectives. Vocabulary around 2,800 words.",
  45: "B1 entry. Month 11–12. Indirect speech ('He said that,' 'She told me'). Reporting and summarizing. Vocabulary near 3,000 words.",
  46: "B1. Month 12. Discourse markers: 'firstly,' 'secondly,' 'in addition,' 'to conclude.' A clear position supported by two or three reasons. Vocabulary near 3,200 words.",
  47: "B1. Month 12–13. Expository paragraph with cause-and-effect language ('as a result,' 'this leads to'). Vocabulary around 3,400 words.",
  48: "B1. Month 13. Active and passive voice used naturally. Vocabulary near 3,600 words.",
  49: "B1. Month 13–14. Conditional type 2 ('If I were,' 'I would'). Hypothetical and counterfactual reasoning. Vocabulary around 3,800 words.",
  50: "B1. Month 14–15. Sustained paragraph with clear structure, varied sentence length, and some subordinate clauses. Vocabulary around 4,000 words. Some idiomatic language. Comparable in difficulty to a young-adult novel or a straightforward news article.",
  51: "B1. Month 15. A short reasoned argument: clear claim, one or two supporting reasons, brief acknowledgment of a counter-point. Vocabulary around 4,100 words. Connectors signal logical relations between sentences.",
  52: "B1. Month 15. Complex sentences with multiple subordinate clauses. Emerging personal voice. Vocabulary near 4,300 words.",
  53: "B1. Month 16. Clear exposition with examples. Some technical vocabulary used precisely. Vocabulary around 4,600 words.",
  54: "B1. Month 16–17. Comparative paragraph holding two or more cases in parallel. Vocabulary near 4,900 words.",
  55: "B1–B2 boundary. Month 17. Moderate complexity and fluency. Some idiomatic language and varied sentence structures. Vocabulary around 5,200 words. The writing feels natural and connected rather than constructed.",
  56: "B1. About 18 months. Vocabulary roughly 5,500 words active. Varied sentence structures, clear argumentation, emerging idioms. Comparable in difficulty to a standard newspaper article or short popular nonfiction.",
  57: "B1–B2. Month 18–20. Sustained argument with a thesis, evidence, and concluding observation. Vocabulary near 5,800 words.",
  58: "B1–B2. Month 20. Accessible exposition of complex ideas with concrete illustrations. Some figurative language. Vocabulary around 6,100 words.",
  59: "B2 approach. Month 21. Sentence variety increases; the prose has rhythm. Observation, reflection, and a small argumentative thread. Vocabulary near 6,400 words.",
  60: "B2 entry. Month 22. Reflective prose that moves toward an implicit thesis through accumulated observation. Vocabulary near 6,500 words.",
  61: "B2 approach. Month 22. Abstract nouns and more formal register emerge. Confident, varied prose. Vocabulary around 6,700 words.",
  62: "B2. About 2 years. Vocabulary roughly 7,000–8,000 words. Sustained argumentation, figurative language, subordinate clauses, and moderate stylistic complexity. Comparable in difficulty to a quality newspaper feature or accessible popular nonfiction.",
  63: "B2. 2 years. Longer sentences balanced against short ones for effect. A clear authorial voice begins to emerge. Vocabulary near 8,500 words.",
  64: "B2. 2–2.5 years. Sensory detail, metaphor, and reflection integrated into the prose. Vocabulary around 9,000 words.",
  65: "B2. 2.5 years. Longer analytical argument with counterarguments acknowledged. Concessive and conditional structures used skillfully. Vocabulary near 9,500 words.",
  66: "B2. 2.5–3 years. Polished prose with controlled emotion, specific detail, and observation. Vocabulary around 10,000 words.",
  67: "B2. 3 years. Rich vocabulary, metaphor, and syntactic variety used purposefully. Vocabulary roughly 10,000–12,000 words. Comparable in difficulty to a quality literary novel for general adult readers or a long-form magazine essay.",
  68: "B2–C1 boundary. 3–3.5 years. The prose handles abstraction and ambiguity with ease. Subtext operates beneath the surface. Vocabulary near 12,000 words.",
  69: "B2–C1. 3.5 years. Modal hedging ('it seems,' 'in some sense,' 'one might say') marks uncertainty without abandoning argument. Vocabulary around 12,200 words.",
  70: "B2–C1. 3.5 years. Layered meaning and sophisticated sentence construction. Complex nominal phrases, embedded relative clauses. Vocabulary around 12,500 words.",
  71: "C1 approach. 4 years. Argument unfolds across multiple sentences with qualifications, concessions, and precise distinctions. Vocabulary near 13,000 words.",
  72: "C1 approach. 4–4.5 years. Complex interior monologue or free indirect discourse. The prose rewards close attention. Vocabulary around 13,500 words.",
  73: "C1. About 5 years. Vocabulary roughly 14,000–16,000 words. Complex syntax, nuanced register, embedded irony, sustained argument across multi-sentence units. Inferential reading required; not everything stated. Comparable in difficulty to literary fiction or long-form essays of the calibre of Orwell.",
  74: "C1. 5–5.5 years. Long, carefully weighted sentences. Irony, moral complexity, and precise observation. Vocabulary near 16,000 words.",
  75: "C1. 5.5 years. Technical vocabulary used precisely. Argument builds on previous paragraphs in a chain of reasoning. Vocabulary around 16,500 words.",
  76: "C1. 6 years. Allusions operate without signposting; a well-read audience is assumed. Vocabulary near 17,000 words.",
  77: "C1–C2 boundary. 6–7 years. Considerable intellectual and stylistic density. Abstract ideas handled with precision and elegance. Vocabulary around 17,500 words.",
  78: "C1–C2. 7 years. Qualification is essential to meaning. Sentences carry multiple subordinate clauses; each clause earns its place. Vocabulary around 17,800 words.",
  79: "C1–C2. 7 years. Long sentences with balanced constructions, embedded qualifications, and precise word choices. Vocabulary near 18,000 words.",
  80: "C1–C2. 7–8 years. Demanding syntax; meaning sometimes arrives obliquely. Vocabulary around 18,500 words.",
  81: "C2 approach. 8 years. Complex periodic sentences with a strong authorial voice. The prose makes demands on patience and attention. Vocabulary near 19,000 words.",
  82: "C2. 8–9 years. High density of ideas per sentence. Allusions operate without signposting; considerable cultural literacy assumed. Vocabulary around 19,500 words.",
  83: "C2. 9 years. Long sentences with multiple embedded clauses, precise and sometimes unusual vocabulary, a subtly ironic narrator. The prose rewards re-reading. Vocabulary near 20,000 words.",
  84: "C2. 10+ years / near-native. Vocabulary roughly 20,000–25,000 words. Complex and purposeful syntax; meaning sometimes revealed only in retrospect. High cultural literacy and tolerance for ambiguity required. Comparable in difficulty to Hemingway, Fitzgerald, or a serious academic monograph.",
  85: "C2. 10–12 years near-native. Dense, footnote-worthy argumentation with precise technical vocabulary. Complex sentence architecture. Vocabulary near 22,000 words.",
  86: "C2. 11 years. Highly formal, precise prose with embedded qualifications. Designed to be unambiguous at the expense of elegance. Vocabulary around 22,500 words.",
  87: "C2. 11 years. Formal prose structured around references and procedural conditions. The reader must track conditional chains and exceptions across sentence boundaries. Vocabulary near 22,800 words.",
  88: "C2. 11–12 years. Methodological precision, passive constructions, and discipline-specific terminology used without apology. Vocabulary near 23,000 words.",
  89: "C2. 12 years. Long periodic sentences, embedded irony, unreliable narration, vocabulary drawn from multiple registers. Vocabulary around 23,500 words.",
  90: "Beyond C2. 15+ years / educated native speaker. Vocabulary over 25,000 words. Sentences are long, weighted, and precisely controlled. Allusions expect literary and historical literacy. Comparable in difficulty to the better essays of Orwell or Baldwin.",
  91: "Beyond C2. 15 years. Sustained argumentation across many sentences, building a cumulative case. Vocabulary near 26,000 words. Prose dense with qualifications and distinctions.",
  92: "Beyond C2. 16 years. Sentence as an instrument of precise psychological investigation, branching and self-correcting as it moves. Vocabulary around 26,500 words.",
  93: "Beyond C2. 17 years. Dense argument moving through aphorism, paradox, and reversal. Vocabulary near 27,000 words.",
  94: "Beyond C2. 17–18 years. Every sentence assumes fluency in a specialist discourse and does considerable conceptual work. Vocabulary around 27,500 words.",
  95: "Beyond C2. 20 years / fully educated native speaker. Vocabulary roughly 28,000–30,000 words. Long periodic sentences carry significant weight; the reader must hold the full architecture of a sentence in mind to resolve its meaning. Comparable in difficulty to Dostoevsky in translation, Thomas Hardy, or George Eliot.",
  96: "Beyond C2. 20+ years. Syntax that mirrors the gradient of thought, with parenthetical refinement and figurative language that earns its weight. Vocabulary roughly 29,000 words.",
  97: "Expert level. 20+ years. Closely reasoned distinctions tracked over many sentences. Familiarity with an existing specialist literature presumed. Vocabulary near 30,000 words.",
  98: "Expert level. 20+ years. The sentence itself becomes a drama of qualification, retraction, and recovered perception. Vocabulary around 30,500 words.",
  99: "Expert level. 20+ years. Dense methodological prose, statistical language, and discipline-specific conventions. Vocabulary near 31,000 words.",
  100: "Expert literary. 20+ years. Argument and narrative inseparable; ideas drive the syntax. Vocabulary around 31,500 words.",
};

const raw = fs.readFileSync(FILE, "utf8");
const data = JSON.parse(raw);

let replaced = 0;
for (let i = 1; i <= 100; i++) {
  const key = String(i);
  if (!data[key]) {
    console.error(`Level ${i} missing in data!`);
    process.exit(1);
  }
  if (!descriptions[i]) {
    console.error(`No new description for level ${i}!`);
    process.exit(1);
  }
  data[key].description = descriptions[i];
  replaced++;
}

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log(`Replaced descriptions for ${replaced} levels.`);

// Verify no duplicate adjacent descriptions.
const reloaded = JSON.parse(fs.readFileSync(FILE, "utf8"));
const dupDescs = [];
for (let i = 1; i < 100; i++) {
  if (reloaded[String(i)].description === reloaded[String(i + 1)].description) {
    dupDescs.push([i, i + 1]);
  }
}
if (dupDescs.length > 0) {
  console.error(`Identical adjacent descriptions: ${dupDescs.length}`, dupDescs);
  process.exit(1);
}
console.log("Verified: no identical adjacent descriptions.");
