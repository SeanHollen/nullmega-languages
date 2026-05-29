import type { Question } from "../types";

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed | 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededShuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Listening/reading: content-derived hash so the same question shuffles the same
// way across re-renders and resume, AND remaps `correct` to the new index.
export function shuffleQuestionOptions(q: Question): Question {
  if (q.options.length <= 1) return q;
  const rng = mulberry32(hashString(q.question + q.options.join(`|`)));
  const indices = seededShuffle(
    q.options.map((_, i) => i),
    rng,
  );
  return {
    ...q,
    options: indices.map((i) => q.options[i]),
    correct: indices.indexOf(q.correct),
  };
}
