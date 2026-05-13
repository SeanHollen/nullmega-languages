// ELO tuning: divisor controls sensitivity to rating gaps, K controls max change per exercise
const K = 5;
const DIVISOR = 20;

export type Mode = "reading" | "listening" | "pronunciation" | "writing";

function storageKey(language: string, mode: Mode) {
  const prefix =
    mode === "reading"
      ? "ability"
      : mode === "listening"
        ? "listening_ability"
        : mode === "pronunciation"
          ? "pronunciation_ability"
          : "writing_ability";
  return `${prefix}_${language.toLowerCase().replace(/\s+/g, "_")}`;
}

export function loadAbility(language: string, mode: Mode = "reading"): number | null {
  const stored = localStorage.getItem(storageKey(language, mode));
  return stored === null ? null : parseFloat(stored);
}

function saveAbility(language: string, value: number, mode: Mode) {
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

function expectedScore(playerRating: number, difficulty: number): number {
  return 1 / (1 + Math.pow(10, (difficulty - playerRating) / DIVISOR));
}

export function computeRating(
  language: string,
  correct: number,
  total: number,
  difficulty: number,
  mode: Mode = "reading",
): RatingResult {
  const oldRating = loadAbility(language, mode);
  const outcome = getOutcome(correct, total);

  if (oldRating === null) {
    const change = K * (actualScore(outcome) - 0.5);
    const newRating = Math.max(1, Math.min(100, Math.round((difficulty + change) * 10) / 10));
    saveAbility(language, newRating, mode);
    return {
      outcome,
      oldRating: null,
      newRating,
      change: Math.round(change * 10) / 10,
      isPlacement: true,
    };
  }

  const change = K * (actualScore(outcome) - expectedScore(oldRating, difficulty));
  const newRating = Math.max(1, Math.min(100, Math.round((oldRating + change) * 10) / 10));
  saveAbility(language, newRating, mode);
  return {
    outcome,
    oldRating,
    newRating,
    change: Math.round(change * 10) / 10,
    isPlacement: false,
  };
}
