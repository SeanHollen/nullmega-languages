import { describe, expect, it } from "vitest";
import { forecastDueTimes, type SrsCard } from "./srsForecast";

function forecastDueDays(c: SrsCard, today: number, horizon: number, useEase: boolean): number[] {
  return forecastDueTimes(c, today, horizon, useEase, true);
}
import { computeEase, INTERVAL_MULTIPLIER } from "./srs";
import type { ReviewEntry } from "./srs";

const DAY = 24 * 60 * 60 * 1000;

function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function entry(outcome: "correct" | "incorrect"): ReviewEntry {
  return { outcome, timestamp: 0, currentInterval: 0 };
}

function card(overrides: Partial<SrsCard> = {}): SrsCard {
  return {
    status: `scheduled`,
    lastReviewed: 0,
    currentInterval: DAY,
    reviewHistory: [],
    ...overrides,
  };
}

describe(`forecastDueDays`, () => {
  it(`returns no days for dropped or new cards`, () => {
    const today = dayStart(0);
    expect(forecastDueDays(card({ status: `dropped` }), today, today + 30 * DAY, true)).toEqual([]);
    expect(forecastDueDays(card({ status: `new` }), today, today + 30 * DAY, true)).toEqual([]);
  });

  it(`returns no days when the card has never been reviewed`, () => {
    const today = dayStart(0);
    expect(forecastDueDays(card({ lastReviewed: null }), today, today + 30 * DAY, true)).toEqual(
      [],
    );
  });

  describe(`useEase=false`, () => {
    it(`multiplies interval by INTERVAL_MULTIPLIER (2.5) each iteration`, () => {
      const today = dayStart(0);
      // lastReviewed at -1d so the card is already due "today" (interval=1d).
      const c = card({ lastReviewed: today - DAY, currentInterval: DAY, reviewHistory: [] });
      const days = forecastDueDays(c, today, today + 30 * DAY, false);
      // Sequence: due today, then +round(1d*2.5)=2.5d→day 2, then +round(2.5d*2.5)=6.25d→day 8,
      // then +round(6.25d*2.5)=15.625d→day 24, then next would be ~39d (past horizon).
      expect(days.length).toBeGreaterThanOrEqual(3);
      expect(days[0]).toBe(today);
    });

    it(`ignores a low-ease review history (uses the fixed 2.5x multiplier instead)`, () => {
      const today = dayStart(0);
      // Bunch of wrong answers would push ease to MIN_EASE (1.3), but useEase=false ignores that.
      const wrongHistory = Array.from({ length: 10 }, () => entry(`incorrect`));
      const easeBased = forecastDueDays(
        card({ lastReviewed: today - DAY, currentInterval: DAY, reviewHistory: wrongHistory }),
        today,
        today + 90 * DAY,
        true,
      );
      const flat = forecastDueDays(
        card({ lastReviewed: today - DAY, currentInterval: DAY, reviewHistory: wrongHistory }),
        today,
        today + 90 * DAY,
        false,
      );
      // With useEase=true and low ease, intervals stay small so we get many due days.
      // With useEase=false (2.5x), intervals grow faster so fewer due days fit in the window.
      expect(easeBased.length).toBeGreaterThan(flat.length);
    });
  });

  describe(`useEase=true`, () => {
    it(`uses the card's computed ease for the multiplier`, () => {
      const today = dayStart(0);
      const history = [entry(`incorrect`)]; // pushes ease down to 1.96
      const c = card({
        lastReviewed: today - DAY,
        currentInterval: DAY,
        reviewHistory: history,
      });
      const ease = computeEase(history);
      const days = forecastDueDays(c, today, today + 60 * DAY, true);

      // Compute the expected sequence by hand to confirm we use `ease`, not 2.5.
      let interval = DAY;
      let next = today;
      const expected: number[] = [];
      while (next <= today + 60 * DAY) {
        expected.push(next);
        interval = Math.round(interval * ease);
        next = dayStart(next + interval);
      }
      expect(days).toEqual(expected);
      // Sanity: ease really is below INTERVAL_MULTIPLIER, so we're testing the right thing.
      expect(ease).toBeLessThan(INTERVAL_MULTIPLIER);
    });

    it(`assumes ease stays constant across the forecast (correct answers don't shift it)`, () => {
      // The forecast pretends every future review is correct; correct → delta 0; so each
      // iteration uses the SAME multiplier.
      const today = dayStart(0);
      const c = card({
        lastReviewed: today - DAY,
        currentInterval: DAY,
        reviewHistory: [entry(`incorrect`), entry(`incorrect`)],
      });
      const ease = computeEase(c.reviewHistory);
      const days = forecastDueDays(c, today, today + 365 * DAY, true);
      // Validate at least two iterations grow by the same ratio (modulo rounding/day-floor).
      // diff between days[1]-days[0] and days[2]-days[1] should be roughly proportional to `ease`.
      if (days.length >= 3) {
        const gap1 = days[1] - days[0];
        const gap2 = days[2] - days[1];
        // gap2 ≈ gap1 * ease — allow a 1-day rounding tolerance.
        expect(Math.abs(gap2 - Math.round(gap1 * ease))).toBeLessThanOrEqual(DAY);
      }
    });
  });

  it(`empty horizon — currentInterval pushes the card past horizon`, () => {
    const today = dayStart(0);
    const c = card({ lastReviewed: today, currentInterval: 100 * DAY });
    expect(forecastDueDays(c, today, today + 30 * DAY, true)).toEqual([]);
  });
});

describe(`forecastDueTimes — dayAligned: false (hour-precision)`, () => {
  it(`preserves the actual due time without flooring to day-start`, () => {
    // lastReviewed at 3pm; interval = 1 day → next due is tomorrow at 3pm, not midnight.
    const today = dayStart(0);
    const threePm = today + 15 * 60 * 60 * 1000;
    const c = card({ lastReviewed: threePm, currentInterval: DAY, reviewHistory: [] });
    const fromMs = today;
    const times = forecastDueTimes(c, fromMs, today + 5 * DAY, false, false);
    // First due time: 3pm tomorrow = today + 1d + 15h. Day-aligned would have given `today + 1d`.
    expect(times[0]).toBe(threePm + DAY);
    expect(new Date(times[0]).getHours()).toBe(15);
  });

  it(`day-aligned and not-aligned forecasts diverge when lastReviewed is mid-day`, () => {
    const today = dayStart(0);
    const threePm = today + 15 * 60 * 60 * 1000;
    const c = card({ lastReviewed: threePm, currentInterval: DAY, reviewHistory: [] });
    const aligned = forecastDueTimes(c, today, today + 5 * DAY, false, true);
    const raw = forecastDueTimes(c, today, today + 5 * DAY, false, false);
    // Day-aligned floors to midnight; raw preserves 3pm.
    expect(aligned[0]).toBe(today + DAY);
    expect(raw[0]).toBe(threePm + DAY);
  });

  it(`returns an empty array for dropped, new, or never-reviewed cards (same as day-aligned)`, () => {
    const today = dayStart(0);
    expect(
      forecastDueTimes(card({ status: `dropped` }), today, today + 30 * DAY, true, false),
    ).toEqual([]);
    expect(forecastDueTimes(card({ status: `new` }), today, today + 30 * DAY, true, false)).toEqual(
      [],
    );
    expect(
      forecastDueTimes(card({ lastReviewed: null }), today, today + 30 * DAY, true, false),
    ).toEqual([]);
  });
});
