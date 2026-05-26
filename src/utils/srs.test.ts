import { describe, expect, it } from "vitest";
import { computeEase, DEFAULT_EASE, MIN_EASE, incrementedInterval } from "./srs";
import type { ReviewEntry } from "./srs";

function entry(outcome: "correct" | "incorrect"): ReviewEntry {
  return { outcome, timestamp: 0, currentInterval: 0 };
}

describe("computeEase", () => {
  it("returns the default ease when there is no history", () => {
    expect(computeEase()).toBe(DEFAULT_EASE);
    expect(computeEase([])).toBe(DEFAULT_EASE);
  });

  it("leaves ease unchanged on a correct review (delta 0)", () => {
    expect(computeEase([entry(`correct`), entry(`correct`), entry(`correct`)])).toBeCloseTo(2.5);
  });

  it("subtracts 0.54 per incorrect review", () => {
    expect(computeEase([entry(`incorrect`)])).toBeCloseTo(2.5 - 0.54);
    expect(computeEase([entry(`incorrect`), entry(`incorrect`)])).toBeCloseTo(2.5 - 2 * 0.54);
  });

  it("floors ease at MIN_EASE", () => {
    const history = Array.from({ length: 20 }, () => entry(`incorrect`));
    expect(computeEase(history)).toBe(MIN_EASE);
  });

  it("does not push ease back up after correct reviews follow incorrects", () => {
    // Correct entries have delta 0 — ease stays where it is, doesn't recover.
    const ease = computeEase([entry(`incorrect`), entry(`correct`), entry(`correct`)]);
    expect(ease).toBeCloseTo(2.5 - 0.54);
  });
});

describe("incrementedInterval", () => {
  it("uses computeEase as multiplier when useEase is true (default)", () => {
    const card = {
      currentInterval: 10,
      reviewHistory: [entry(`incorrect`), entry(`incorrect`)],
    };
    const ease = computeEase(card.reviewHistory);
    expect(incrementedInterval(card)).toBe(Math.round(10 * ease));
  });

  it("uses the fixed 2.5x multiplier when useEase is false", () => {
    const card = {
      currentInterval: 10,
      reviewHistory: [entry(`incorrect`), entry(`incorrect`)],
    };
    expect(incrementedInterval(card, { useEase: false })).toBe(Math.round(10 * 2.5));
  });

  it("easy mode multiplies the base by EASY_BONUS — uses per-card ease when useEase is on", () => {
    const card = { currentInterval: 10, reviewHistory: [entry(`incorrect`)] };
    const ease = computeEase(card.reviewHistory);
    expect(incrementedInterval(card, { mode: `easy` })).toBe(Math.round(10 * ease * 2.0));
  });

  it("easy mode multiplies the fixed 2.5x by EASY_BONUS when useEase is off", () => {
    const card = { currentInterval: 10, reviewHistory: [entry(`incorrect`)] };
    expect(incrementedInterval(card, { mode: `easy`, useEase: false })).toBe(
      Math.round(10 * 2.5 * 2.0),
    );
  });

  it("hard mode multiplies the base by HARD_FACTOR", () => {
    const card = { currentInterval: 100, reviewHistory: [] };
    // useEase on, default ease 2.5 → 100 * 2.5 * 0.5 = 125
    expect(incrementedInterval(card, { mode: `hard` })).toBe(125);
    // useEase off → 100 * 2.5 * 0.5 = 125 too (same when ease == INTERVAL_MULTIPLIER)
    expect(incrementedInterval(card, { mode: `hard`, useEase: false })).toBe(125);
  });

  it("hard mode adjusts relative to a low-ease card", () => {
    // Two wrongs → ease drops to ~1.42. hard = 1.42 * 0.5 = ~0.71
    const card = { currentInterval: 100, reviewHistory: [entry(`incorrect`), entry(`incorrect`)] };
    const ease = computeEase(card.reviewHistory);
    expect(incrementedInterval(card, { mode: `hard` })).toBe(Math.round(100 * ease * 0.5));
  });
});
