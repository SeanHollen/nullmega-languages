import difficultyLevels from "../data/difficulty-levels.json";

export interface ExampleRef {
  passage: string;
  question?: { question: string; options: string[]; answer: number };
}

export interface LevelRef {
  description: string;
  examples: ExampleRef[];
}

const levels = difficultyLevels as Record<string, LevelRef>;

interface RefBlockOptions {
  includeQuestion?: boolean;
}

function clamp(level: number): number {
  return Math.max(1, Math.min(100, Math.round(level)));
}

export function refBlock(level: number, label: string, options: RefBlockOptions = {}): string {
  const clamped = clamp(level);
  const r = levels[String(clamped)];
  const { includeQuestion = false } = options;
  const exampleLines = r.examples
    .map((e, i) => {
      const letter = String.fromCharCode(65 + i);
      if (includeQuestion && e.question) {
        const qLine = `\n  Question ${letter}: "${e.question.question}" — correct answer: "${e.question.options[e.question.answer ?? 0]}"`;
        return `  Example ${letter}: "${e.passage}"${qLine}`;
      }
      return `  Example ${letter}: "${e.passage}"`;
    })
    .join("\n");
  return `${label} (level ${clamped}):\n  Description: ${r.description}\n${exampleLines}`;
}

// Returns three reference blocks: one level easier, target level, one level harder. Both
// reading and writing prompts use this triad to give the model a difficulty gradient.
export function referenceBlocks(level: number, options: RefBlockOptions = {}): string {
  const target = clamp(level);
  const lo = Math.max(1, target - 1);
  const hi = Math.min(100, target + 1);
  return [
    refBlock(lo, "One level easier", options),
    refBlock(target, "Target level", options),
    refBlock(hi, "One level harder", options),
  ].join("\n\n");
}
