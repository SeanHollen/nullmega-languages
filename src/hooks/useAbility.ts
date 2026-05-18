import { getHistory } from "../utils/history";
import { db, type AbilityRow } from "../utils/db";

// ELO tuning: K_MAX is the K factor when confidence is 0 (no prior data, or all prior data
// has fully decayed). DIVISOR controls sensitivity to rating gaps. PLACEMENT_K is the small
// nudge applied on the very first assessment, when we anchor the rating near the language complexity.
const K_MAX = 40;
const PLACEMENT_K = 5;
const DIVISOR = 20;
// τ = 180 days: 1 year ago → ~13% weight, 6 months ago → ~37%.
const TAU_MS = 180 * 24 * 60 * 60 * 1000;

export type Mode = "reading" | "listening" | "pronunciation" | "writing";

export const DEFAULT_LANGUAGE_COMPLEXITY: Record<Mode, number> = {
  reading: 50,
  listening: 40,
  pronunciation: 30,
  writing: 20,
};

function abilityId(language: string, mode: Mode): string {
  return `${language}|${mode}`;
}

async function loadRow(language: string, mode: Mode): Promise<AbilityRow | null> {
  const row = await db().abilities.get(abilityId(language, mode));
  return row ?? null;
}

async function upsertRow(row: AbilityRow): Promise<void> {
  await db().abilities.put(row);
}

interface ConfidenceState {
  value: number;
  updatedAt: number;
}

// If the user has assessment history but no stored confidence (pre-feature data), seed
// confidence from that history.
async function bootstrapConfidenceFromHistory(
  language: string,
  mode: Mode,
): Promise<ConfidenceState> {
  const history = await getHistory(mode, language);
  const completed = history.filter(
    (r): r is typeof r & { completedAt: number } => typeof r.completedAt === `number`,
  );
  if (completed.length === 0) return { value: 0, updatedAt: 0 };
  const now = Date.now();
  const value = completed.reduce(
    (sum, rec) => sum + Math.exp(-(now - rec.completedAt) / TAU_MS),
    0,
  );
  const updatedAt = completed.reduce((max, rec) => Math.max(max, rec.completedAt), 0);
  return { value, updatedAt };
}

export async function loadAbility(
  language: string,
  mode: Mode = `reading`,
): Promise<number | null> {
  const row = await loadRow(language, mode);
  return row?.rating ?? null;
}

export async function saveAbility(language: string, value: number, mode: Mode): Promise<void> {
  const clamped = Math.max(1, Math.min(100, value));
  const rounded = Math.round(clamped * 10) / 10;
  const id = abilityId(language, mode);
  const existing = await db().abilities.get(id);
  await upsertRow({
    id,
    language,
    mode,
    rating: rounded,
    confidenceValue: existing?.confidenceValue ?? 0,
    confidenceUpdatedAt: existing?.confidenceUpdatedAt ?? 0,
  });
}

export type Outcome = "win" | "draw" | "loss";

export interface RatingResult {
  outcome: Outcome;
  oldRating: number | null;
  newRating: number;
  change: number;
  isPlacement: boolean;
}

function getOutcome(correct: number, total: number): Outcome {
  const pct = correct / total;
  if (pct >= 0.9) return `win`;
  if (pct >= 0.6) return `draw`;
  return `loss`;
}

// Rebuilds a RatingResult from a stored AssessmentRecord. Used by HistoryViewPage to
// render the same outcome card / before→after delta the live results page shows. Pure.
export function rebuildRatingResult(record: {
  scoreEarned: number;
  scoreMax: number;
  ratingBefore: number | null;
  ratingAfter: number | null;
}): RatingResult | null {
  if (record.ratingAfter === null) return null;
  const outcome = record.scoreMax > 0 ? getOutcome(record.scoreEarned, record.scoreMax) : `draw`;
  const isPlacement = record.ratingBefore === null;
  const change = isPlacement ? 0 : record.ratingAfter - record.ratingBefore!;
  return {
    outcome,
    oldRating: record.ratingBefore,
    newRating: record.ratingAfter,
    change,
    isPlacement,
  };
}

function actualScore(outcome: Outcome): number {
  if (outcome === `win`) return 1.0;
  if (outcome === `draw`) return 0.5;
  return 0.0;
}

function expectedScore(playerRating: number, languageComplexity: number): number {
  return 1 / (1 + Math.pow(10, (languageComplexity - playerRating) / DIVISOR));
}

export async function computeRating(
  language: string,
  correct: number,
  total: number,
  languageComplexity: number,
  mode: Mode = `reading`,
): Promise<RatingResult> {
  const existing = await loadRow(language, mode);
  const oldRating = existing?.rating ?? null;
  const outcome = getOutcome(correct, total);
  const now = Date.now();
  const id = abilityId(language, mode);

  if (oldRating === null) {
    const change = PLACEMENT_K * (actualScore(outcome) - 0.5);
    const newRating = Math.max(
      1,
      Math.min(100, Math.round((languageComplexity + change) * 10) / 10),
    );
    await upsertRow({
      id,
      language,
      mode,
      rating: newRating,
      confidenceValue: 1,
      confidenceUpdatedAt: now,
    });
    return {
      outcome,
      oldRating: null,
      newRating,
      change: Math.round(change * 10) / 10,
      isPlacement: true,
    };
  }

  const priorValue = existing?.confidenceValue ?? 0;
  const priorUpdatedAt = existing?.confidenceUpdatedAt ?? 0;
  let confidenceValue = priorValue;
  let confidenceUpdatedAt = priorUpdatedAt;
  // Seed from history on the very first ranked assessment after the user has been using
  // the app long enough to have history but no confidence row.
  if (priorValue === 0 && priorUpdatedAt === 0) {
    const bootstrap = await bootstrapConfidenceFromHistory(language, mode);
    confidenceValue = bootstrap.value;
    confidenceUpdatedAt = bootstrap.updatedAt;
  }
  const decayed =
    confidenceUpdatedAt > 0
      ? confidenceValue * Math.exp(-(now - confidenceUpdatedAt) / TAU_MS)
      : confidenceValue;
  const K = K_MAX / (decayed + 1);
  const change = K * (actualScore(outcome) - expectedScore(oldRating, languageComplexity));
  const newRating = Math.max(1, Math.min(100, Math.round((oldRating + change) * 10) / 10));
  await upsertRow({
    id,
    language,
    mode,
    rating: newRating,
    confidenceValue: decayed + 1,
    confidenceUpdatedAt: now,
  });
  return {
    outcome,
    oldRating,
    newRating,
    change: Math.round(change * 10) / 10,
    isPlacement: false,
  };
}
