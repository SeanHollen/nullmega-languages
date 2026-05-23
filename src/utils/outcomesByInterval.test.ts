import { describe, expect, it } from "vitest";
import {
  aggregateOutcomesByDay,
  aggregateOutcomesByHour,
  aggregateOutcomesByInterval,
  formatIntervalLabel,
} from "./outcomesByInterval";

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

function reviewAt(ts: number, outcome: "correct" | "incorrect") {
  return { outcome, currentInterval: DAY, timestamp: ts };
}

function localDayStartOf(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

describe("aggregateOutcomesByDay", () => {
  it("returns an empty array when no cards have history", () => {
    expect(aggregateOutcomesByDay([])).toEqual([]);
    expect(aggregateOutcomesByDay([{}])).toEqual([]);
  });

  it("buckets reviews by local calendar day and fills gaps with zero days", () => {
    const day0 = localDayStartOf(new Date(2026, 0, 10, 9, 0).getTime());
    const day2 = day0 + 2 * DAY;
    const out = aggregateOutcomesByDay([
      {
        reviewHistory: [
          reviewAt(day0 + 60_000, `correct`),
          reviewAt(day0 + 120_000, `incorrect`),
          reviewAt(day2 + 60_000, `correct`),
        ],
      },
    ]);
    expect(out).toEqual([
      { dayStart: day0, correct: 1, incorrect: 1 },
      { dayStart: day0 + DAY, correct: 0, incorrect: 0 },
      { dayStart: day2, correct: 1, incorrect: 0 },
    ]);
  });
});

describe("aggregateOutcomesByHour", () => {
  it("returns 24 zero-buckets when no cards have history", () => {
    const out = aggregateOutcomesByHour([]);
    expect(out.length).toBe(24);
    expect(out.every((b) => b.correct === 0 && b.incorrect === 0)).toBe(true);
  });

  it("buckets reviews by local hour-of-day", () => {
    const at = (h: number) => new Date(2026, 0, 10, h, 30).getTime();
    const out = aggregateOutcomesByHour([
      {
        reviewHistory: [
          reviewAt(at(9), `correct`),
          reviewAt(at(9), `correct`),
          reviewAt(at(9), `incorrect`),
          reviewAt(at(22), `correct`),
        ],
      },
    ]);
    expect(out[9]).toEqual({ hour: 9, correct: 2, incorrect: 1 });
    expect(out[22]).toEqual({ hour: 22, correct: 1, incorrect: 0 });
    expect(out[0]).toEqual({ hour: 0, correct: 0, incorrect: 0 });
  });
});
