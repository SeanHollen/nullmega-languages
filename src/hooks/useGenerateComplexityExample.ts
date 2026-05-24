import { callOnboardingComplexityExamples } from "../utils/api";

export type ComplexityExamples = Record<number, string>;

export async function generateComplexityExamples(language: string): Promise<ComplexityExamples> {
  const raw = await callOnboardingComplexityExamples(language);
  const out: ComplexityExamples = {};
  for (const [k, v] of Object.entries(raw)) {
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= 100 && typeof v === `string`) out[n] = v;
  }
  return out;
}
