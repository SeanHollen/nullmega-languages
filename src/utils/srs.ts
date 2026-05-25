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
export const INTERVALS = [1, 3, 7, 14, 30, 90, 180, 365].map((d) => d * DAY);
export const INITIAL_INTERVAL = INTERVALS[0];

export function nextInterval(currentInterval: number): number {
  const idx = INTERVALS.findIndex((i) => i > currentInterval);
  return idx >= 0 ? INTERVALS[idx] : INTERVALS[INTERVALS.length - 1];
}

export function easyInterval(currentInterval: number): number {
  let interval = currentInterval;
  for (let i = 0; i < 3; i++) {
    interval = nextInterval(interval);
  }
  return interval;
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
        currentInterval: wasRelearning ? INITIAL_INTERVAL : nextInterval(card.currentInterval),
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
