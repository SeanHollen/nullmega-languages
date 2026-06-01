import { db } from "./db";

// One row per LLM call made on the BYOK path. Standard-mode calls are paid for by
// the operator and tracked server-side; we don't write rows for those.
export type UsageCategory =
  | "reading"
  | "listening"
  | "writing"
  | "pronunciation"
  | "vocabulary"
  | "grammar";

export const USAGE_CATEGORIES: UsageCategory[] = [
  `reading`,
  `listening`,
  `writing`,
  `pronunciation`,
  `vocabulary`,
  `grammar`,
];

export interface UsageRow {
  id: string;
  timestamp: number;
  category: UsageCategory;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

// Per-model pricing in USD per 1M tokens. Update when OpenAI changes prices — these
// values are the source of truth for cost computation, so they're worth a periodic
// sanity-check against the platform billing page.
interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const MODEL_PRICING: Record<string, ModelPricing> = {
  "o4-mini": { inputPerMillion: 1.1, outputPerMillion: 4.4 },
};

const FALLBACK_PRICING: ModelPricing = { inputPerMillion: 1.1, outputPerMillion: 4.4 };

export function priceFor(model: string): ModelPricing {
  return MODEL_PRICING[model] ?? FALLBACK_PRICING;
}

export function computeCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = priceFor(model);
  return (
    (promptTokens * p.inputPerMillion) / 1_000_000 +
    (completionTokens * p.outputPerMillion) / 1_000_000
  );
}

export async function recordUsage(args: {
  category: UsageCategory;
  model: string;
  promptTokens: number;
  completionTokens: number;
}): Promise<void> {
  const costUsd = computeCostUsd(args.model, args.promptTokens, args.completionTokens);
  const row: UsageRow = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: Date.now(),
    ...args,
    costUsd,
  };
  await db().apiUsage.put(row);
}

export async function loadAllUsage(): Promise<UsageRow[]> {
  return await db().apiUsage.toArray();
}
