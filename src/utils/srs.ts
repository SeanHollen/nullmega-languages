// Shared SRS state machine. Flashcards (vocab) and grammar cards both use this — the
// only differences are card-specific fields layered on top (vocab has contexts, grammar
// has questions, etc.) and the configurable learn-mode graduation threshold.

export type SrsStoredStatus = "new" | "learning" | "scheduled" | "dropped";
export type SrsStatus = SrsStoredStatus | "due" | "relearning";

export interface ReviewEntry {
  outcome: "correct" | "incorrect";
  timestamp: number;
  // The interval the card had at the moment it was reviewed.
  currentInterval: number;
}

export interface SrsCard {
  // Identity / metadata shared by every card type.
  id: string;
  language: string;
  addedAt: number;
  tags: string[];
  // SRS state machine.
  status: SrsStoredStatus;
  lastReviewed: number | null;
  currentInterval: number;
  // Set when a due card was answered wrong; cleared on next clean graduation. A
  // scheduled+due card with this flag set derives to "relearning".
  relearningStartedAt: number | null;
  // Number of consecutive correct answers given while in `learning` status. `null` means
  // the card has never been shown. Only meaningful when status === "learning".
  learningCorrectCount: number | null;
  reviewHistory: ReviewEntry[];
}

export function computeSrsStatus(card: SrsCard): SrsStatus {
  if (card.status === `dropped`) return `dropped`;
  if (card.status === `new`) return `new`;
  if (card.status === `learning`) return `learning`;
  // status === "scheduled"
  const isDue =
    card.lastReviewed !== null && card.lastReviewed + card.currentInterval <= Date.now();
  if (!isDue) return `scheduled`;
  return card.relearningStartedAt !== null ? `relearning` : `due`;
}

const DAY = 24 * 60 * 60 * 1000;
export const INITIAL_INTERVAL = DAY;
export const INTERVAL_MULTIPLIER = 2.5;
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
// Ease describes the card's intrinsic difficulty (derived from history). Easy/hard are
// session-time multipliers applied ON TOP of ease — they bump or shrink the next
// interval without changing ease itself.
export const EASY_BONUS = 2.0;
export const HARD_FACTOR = 0.5;

// SM-2 style: each review nudges ease by a quality-derived delta. We collapse Anki's
// 0..5 quality scale to two outcomes: correct=q4 (delta 0), incorrect=q1 (delta -0.54).
export function computeEase(reviewHistory: ReviewEntry[] = []): number {
  let ease = DEFAULT_EASE;
  for (const entry of reviewHistory) {
    const q = entry.outcome === `correct` ? 4 : 1;
    ease = Math.max(MIN_EASE, ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  }
  return ease;
}

// "easy" jumps three multiplier steps ahead in one go; "hard" only steps a little.
// In normal (right-answer) mode, the multiplier is either the card's per-card ease
// (computed from its review history) or the fixed INTERVAL_MULTIPLIER, depending on
// the user's `useEase` setting.
export function incrementedInterval(
  card: { currentInterval: number; reviewHistory?: ReviewEntry[] },
  options: { mode?: "easy" | "hard"; useEase?: boolean } = {},
): number {
  const { mode, useEase = true } = options;
  const base = useEase ? computeEase(card.reviewHistory) : INTERVAL_MULTIPLIER;
  let multiplier = base;
  if (mode === `easy`) multiplier = base * EASY_BONUS;
  else if (mode === `hard`) multiplier = base * HARD_FACTOR;
  return Math.round(card.currentInterval * multiplier);
}

export interface SrsAnswerResult {
  patch: Partial<SrsCard>;
  graduate: boolean;
}

// Pure computation: given an SRS card and an answer, returns the patch to apply and
// whether this answer graduates the card out of the session. `learnStepsRequired` is the
// number of consecutive correct answers needed in learn-mode (vocab uses 2, grammar 1).
export function computeSrsAnswerPatch(
  card: SrsCard,
  mode: "learn" | "review",
  right: boolean,
  now: number,
  learnStepsRequired: number,
  useEase: boolean,
): SrsAnswerResult {
  if (mode === `learn`) {
    if (right) {
      const newCount = (card.learningCorrectCount ?? 0) + 1;
      if (newCount >= learnStepsRequired) {
        return {
          graduate: true,
          patch: {
            status: `scheduled`,
            lastReviewed: now,
            currentInterval: INITIAL_INTERVAL,
            learningCorrectCount: 0,
            relearningStartedAt: null,
          },
        };
      }
      return {
        graduate: false,
        patch: { lastReviewed: now, learningCorrectCount: newCount },
      };
    }
    return {
      graduate: false,
      patch: { lastReviewed: now, learningCorrectCount: 0 },
    };
  }
  // review mode
  const existing = card.reviewHistory ?? [];
  const isRelearningPractice = card.relearningStartedAt !== null;
  const reviewHistory = isRelearningPractice
    ? existing
    : [
        ...existing,
        {
          outcome: (right ? `correct` : `incorrect`) as "correct" | "incorrect",
          timestamp: now,
          currentInterval: card.currentInterval,
        },
      ];
  if (right) {
    const wasRelearning = card.relearningStartedAt !== null;
    return {
      graduate: true,
      patch: {
        status: `scheduled`,
        lastReviewed: now,
        currentInterval: wasRelearning
          ? INITIAL_INTERVAL
          : incrementedInterval({ ...card, reviewHistory }, { useEase }),
        relearningStartedAt: null,
        reviewHistory,
      },
    };
  }
  return {
    graduate: false,
    patch: {
      lastReviewed: now,
      currentInterval: 0,
      relearningStartedAt: now,
      reviewHistory,
    },
  };
}
