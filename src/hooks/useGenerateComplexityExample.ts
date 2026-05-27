import { z } from "zod";
import { callOnboardingComplexityExamples } from "../utils/api";

export type ComplexityExamples = Record<number, string>;

const ExamplesEntrySchema = z.tuple([z.string(), z.string()]);

export async function generateComplexityExamples(language: string): Promise<ComplexityExamples> {
  const raw = await callOnboardingComplexityExamples(language);
  const out: ComplexityExamples = {};
  for (const entry of Object.entries(raw)) {
    const r = ExamplesEntrySchema.safeParse(entry);
    if (!r.success) continue;
    const [k, v] = r.data;
    const n = Number(k);
    if (Number.isInteger(n) && n >= 1 && n <= 100) out[n] = v;
  }
  return out;
}
