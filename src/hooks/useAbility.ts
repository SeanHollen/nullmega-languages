import { getHistory } from "../utils/history";

// ELO tuning: K_MAX is the K factor when confidence is 0 (no prior data, or all prior data
// has fully decayed). DIVISOR controls sensitivity to rating gaps. PLACEMENT_K is the small
// nudge applied on the very first assessment, when we anchor the rating near the language complexity.
const K_MAX = 40;
const PLACEMENT_K = 5;
const DIVISOR = 20;
// τ = 180 days: 1 year ago → ~13% weight, 6 months ago → ~37%.
const TAU_MS = 180 * 24 * 60 * 60 * 1000;

export type Mode = "reading" | "listening" | "pronunciation" | "writing";

const STORAGE_PREFIX: Record<Mode, string> = {
  reading: "ability",
  listening: "listening_ability",
  pronunciation: "pronunciation_ability",
  writing: "writing_ability",
};

export const DEFAULT_LANGUAGE_COMPLEXITY: Record<Mode, number> = {
  reading: 50,
  listening: 40,
  pronunciation: 30,
  writing: 20,
};

function storageKey(language: string, mode: Mode) {
  return `${STORAGE_PREFIX[mode]}_${language.toLowerCase().replace(/\s+/g, "_")}`;
}

function confidenceKey(language: string, mode: Mode) {
  return `${storageKey(language, mode)}_confidence`;
}

interface ConfidenceState {
  value: number;
  updatedAt: number;
}

function loadConfidence(language: string, mode: Mode): ConfidenceState {
  const raw = localStorage.getItem(confidenceKey(language, mode));
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ConfidenceState;
      if (typeof parsed.value === "number" && typeof parsed.updatedAt === "number") {
        return parsed;
      }
    } catch {
      // fall through to bootstrap
    }
  }
  const history = getHistory(mode, language);
  if (history.length === 0) return { value: 0, updatedAt: 0 };
  const now = Date.now();
  const value = history.reduce((sum, rec) => sum + Math.exp(-(now - rec.completedAt) / TAU_MS), 0);
  const updatedAt = history.reduce((max, rec) => Math.max(max, rec.completedAt), 0);
  return { value, updatedAt };
}

function saveConfidence(language: string, mode: Mode, conf: ConfidenceState) {
  localStorage.setItem(confidenceKey(language, mode), JSON.stringify(conf));
}

export function loadAbility(language: string, mode: Mode = "reading"): number | null {
  const stored = localStorage.getItem(storageKey(language, mode));
  return stored === null ? null : parseFloat(stored);
}

export function saveAbility(language: string, value: number, mode: Mode) {
  const clamped = Math.max(1, Math.min(100, value));
  localStorage.setItem(storageKey(language, mode), String(Math.round(clamped * 10) / 10));
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
  if (pct >= 0.9) return "win";
  if (pct >= 0.6) return "draw";
  return "loss";
}

function actualScore(outcome: Outcome): number {
  if (outcome === "win") return 1.0;
  if (outcome === "draw") return 0.5;
  return 0.0;
}

function expectedScore(playerRating: number, languageComplexity: number): number {
  return 1 / (1 + Math.pow(10, (languageComplexity - playerRating) / DIVISOR));
}

export function computeRating(
  language: string,
  correct: number,
  total: number,
  languageComplexity: number,
  mode: Mode = "reading",
): RatingResult {
  const oldRating = loadAbility(language, mode);
  const outcome = getOutcome(correct, total);
  const now = Date.now();

  if (oldRating === null) {
    const change = PLACEMENT_K * (actualScore(outcome) - 0.5);
    const newRating = Math.max(
      1,
      Math.min(100, Math.round((languageComplexity + change) * 10) / 10),
    );
    saveAbility(language, newRating, mode);
    saveConfidence(language, mode, { value: 1, updatedAt: now });
    return {
      outcome,
      oldRating: null,
      newRating,
      change: Math.round(change * 10) / 10,
      isPlacement: true,
    };
  }

  const prior = loadConfidence(language, mode);
  const decayed =
    prior.updatedAt > 0 ? prior.value * Math.exp(-(now - prior.updatedAt) / TAU_MS) : prior.value;
  const K = K_MAX / (decayed + 1);
  const change = K * (actualScore(outcome) - expectedScore(oldRating, languageComplexity));
  const newRating = Math.max(1, Math.min(100, Math.round((oldRating + change) * 10) / 10));
  saveAbility(language, newRating, mode);
  saveConfidence(language, mode, { value: decayed + 1, updatedAt: now });
  return {
    outcome,
    oldRating,
    newRating,
    change: Math.round(change * 10) / 10,
    isPlacement: false,
  };
}
