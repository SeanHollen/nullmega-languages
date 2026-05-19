import { describe, expect, it } from "vitest";
import { aggregateOutcomesByInterval, formatIntervalLabel } from "./outcomesByInterval";

const DAY = 24 * 60 * 60 * 1000;

function card(history: { outcome: "correct" | "incorrect"; currentInterval: number }[]) {
  return {
    reviewHistory: history.map((h) => ({ ...h, timestamp: 0 })),
  };
}

describe("aggregateOutcomesByInterval", () => {
  it("returns an empty array when no cards have history", () => {
    expect(aggregateOutcomesByInterval([])).toEqual([]);
    expect(aggregateOutcomesByInterval([{}])).toEqual([]);
  });

  it("counts correct and incorrect per interval across cards", () => {
    const out = aggregateOutcomesByInterval([
      card([
        { outcome: `correct`, currentInterval: DAY },
        { outcome: `incorrect`, currentInterval: 7 * DAY },
      ]),
      card([
        { outcome: `correct`, currentInterval: DAY },
        { outcome: `correct`, currentInterval: 7 * DAY },
      ]),
    ]);
    expect(out).toEqual([
      { intervalMs: DAY, correct: 2, incorrect: 0 },
      { intervalMs: 7 * DAY, correct: 1, incorrect: 1 },
    ]);
  });

  it("sorts the result by interval ascending", () => {
    const out = aggregateOutcomesByInterval([
      card([
        { outcome: `correct`, currentInterval: 30 * DAY },
        { outcome: `correct`, currentInterval: 3 * DAY },
        { outcome: `correct`, currentInterval: 7 * DAY },
      ]),
    ]);
    expect(out.map((o) => o.intervalMs)).toEqual([3 * DAY, 7 * DAY, 30 * DAY]);
  });

  it("ignores cards with no history", () => {
    const out = aggregateOutcomesByInterval([
      {},
      { reviewHistory: [] },
      card([{ outcome: `correct`, currentInterval: DAY }]),
    ]);
    expect(out).toEqual([{ intervalMs: DAY, correct: 1, incorrect: 0 }]);
  });
});

describe("formatIntervalLabel", () => {
  it("formats short intervals in days", () => {
    expect(formatIntervalLabel(DAY)).toBe(`1d`);
    expect(formatIntervalLabel(3 * DAY)).toBe(`3d`);
  });

  it("formats week-scale intervals as weeks", () => {
    expect(formatIntervalLabel(7 * DAY)).toBe(`1w`);
    expect(formatIntervalLabel(14 * DAY)).toBe(`2w`);
  });

  it("formats month-scale intervals as months", () => {
    expect(formatIntervalLabel(30 * DAY)).toBe(`1m`);
    expect(formatIntervalLabel(90 * DAY)).toBe(`3m`);
    expect(formatIntervalLabel(180 * DAY)).toBe(`6m`);
  });

  it("formats year-scale intervals as years", () => {
    expect(formatIntervalLabel(365 * DAY)).toBe(`1y`);
  });
});
