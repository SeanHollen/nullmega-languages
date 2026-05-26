import { describe, expect, it } from "vitest";
import {
  aggregateOutcomesByDay,
  aggregateOutcomesByEase,
  aggregateOutcomesByHour,
  aggregateOutcomesByIntervalBucket,
  formatIntervalLabel,
} from "./outcomesByInterval";

const DAY = 24 * 60 * 60 * 1000;

function card(history: { outcome: "correct" | "incorrect"; currentInterval: number }[]) {
  return {
    reviewHistory: history.map((h) => ({ ...h, timestamp: 0 })),
  };
}

describe("aggregateOutcomesByIntervalBucket", () => {
  it("returns 8 zero-buckets when no cards have history", () => {
    const out = aggregateOutcomesByIntervalBucket([]);
    expect(out.length).toBe(8);
    expect(out.every((b) => b.correct === 0 && b.incorrect === 0)).toBe(true);
    expect(out.map((b) => b.bucketLabel)).toEqual([
      `<1d`,
      `1–3d`,
      `3–7d`,
      `7–14d`,
      `14–30d`,
      `30–90d`,
      `90d–1y`,
      `1y+`,
    ]);
  });

  it("places reviews into Anki-style interval bands by currentInterval", () => {
    const out = aggregateOutcomesByIntervalBucket([
      card([
        { outcome: `correct`, currentInterval: 0 }, // <1d
        { outcome: `incorrect`, currentInterval: DAY }, // 1–3d
        { outcome: `correct`, currentInterval: 5 * DAY }, // 3–7d
        { outcome: `correct`, currentInterval: 365 * DAY }, // 1y+
      ]),
    ]);
    expect(out[0]).toMatchObject({ bucketLabel: `<1d`, correct: 1, incorrect: 0 });
    expect(out[1]).toMatchObject({ bucketLabel: `1–3d`, correct: 0, incorrect: 1 });
    expect(out[2]).toMatchObject({ bucketLabel: `3–7d`, correct: 1, incorrect: 0 });
    expect(out[7]).toMatchObject({ bucketLabel: `1y+`, correct: 1, incorrect: 0 });
  });
});

describe("aggregateOutcomesByEase", () => {
  it("returns 8 zero-buckets when no cards have history", () => {
    const out = aggregateOutcomesByEase([]);
    expect(out.length).toBe(8);
    expect(out.every((b) => b.correct === 0 && b.incorrect === 0)).toBe(true);
  });

  it("attributes a card's review history to the bucket matching its current ease", () => {
    // A card with all-correct history stays at ease 2.5 → bucket "2.4–2.7" (index 4).
    const allCorrect = card([
      { outcome: `correct`, currentInterval: DAY },
      { outcome: `correct`, currentInterval: DAY },
    ]);
    const out = aggregateOutcomesByEase([allCorrect]);
    expect(out[4]).toMatchObject({ bucketLabel: `2.4–2.7`, correct: 2, incorrect: 0 });
  });

  it("pushes a card with many wrong answers into a low-ease bucket", () => {
    // Many wrong answers — ease quickly hits the 1.3 floor → bucket "<1.5".
    const mostlyWrong = card([
      { outcome: `incorrect`, currentInterval: DAY },
      { outcome: `incorrect`, currentInterval: DAY },
      { outcome: `incorrect`, currentInterval: DAY },
      { outcome: `incorrect`, currentInterval: DAY },
    ]);
    const out = aggregateOutcomesByEase([mostlyWrong]);
    expect(out[0].bucketLabel).toBe(`<1.5`);
    expect(out[0].correct + out[0].incorrect).toBe(4);
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
