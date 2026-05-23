import { describe, expect, it } from "vitest";
import { recordToday, loadStreaks, computeCurrentStreak, todayStr, dateStr } from "./streaks";
import { db } from "./db";

describe("recordToday", () => {
  it("creates a new entry on first call", async () => {
    await recordToday(true, true);
    const all = await loadStreaks();
    expect(all.length).toBe(1);
    expect(all[0]).toMatchObject({ date: todayStr(), complete: true, hadObligations: true });
  });

  it("overwrites the same-day entry on subsequent calls", async () => {
    await recordToday(false, true);
    await recordToday(true, true);
    const all = await loadStreaks();
    expect(all.length).toBe(1);
    expect(all[0]).toMatchObject({ complete: true, hadObligations: true });
  });

  it("preserves earlier-day entries when recording today", async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await db().streaks.put({ date: dateStr(yesterday), complete: true, hadObligations: true });
    await recordToday(false, true);
    const all = await loadStreaks();
    expect(all.length).toBe(2);
  });

  it("does upgrade a non-green day to green when the user finishes their obligations", async () => {
    // Morning: not yet done. Evening: finished everything. The green status must stick.
    await recordToday(false, true);
    await recordToday(true, true);
    const all = await loadStreaks();
    expect(all.length).toBe(1);
    expect(all[0]).toMatchObject({ complete: true, hadObligations: true });
  });

  it("does not downgrade a green day if a later call reports the day as incomplete", async () => {
    // Once today has been recorded as complete + with obligations (a "green" day),
    // a subsequent call with complete=false must not overwrite it. Otherwise mid-day
    // events like a new vocab card coming due or a goal being raised retroactively
    // un-green a day the user had already finished.
    await recordToday(true, true);
    await recordToday(false, true);
    const all = await loadStreaks();
    expect(all.length).toBe(1);
    expect(all[0]).toMatchObject({ complete: true, hadObligations: true });
  });
});

async function setHistory(
  entries: { date: Date; complete: boolean; hadObligations: boolean }[],
): Promise<void> {
  await db().streaks.bulkPut(
    entries.map((e) => ({
      date: dateStr(e.date),
      complete: e.complete,
      hadObligations: e.hadObligations,
    })),
  );
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

describe("computeCurrentStreak", () => {
  it("returns 0 for an empty history", async () => {
    expect(computeCurrentStreak(await loadStreaks())).toBe(0);
  });

  it("returns 1 when only today is complete", async () => {
    await recordToday(true, true);
    expect(computeCurrentStreak(await loadStreaks())).toBe(1);
  });

  it("counts a no-obligation day as a streak day (freebie)", async () => {
    await recordToday(false, false);
    expect(computeCurrentStreak(await loadStreaks())).toBe(1);
  });

  it("does not break the streak when today is recorded incomplete (free pass for today)", async () => {
    await setHistory([
      { date: daysAgo(2), complete: true, hadObligations: true },
      { date: daysAgo(1), complete: true, hadObligations: true },
    ]);
    await recordToday(false, true);
    expect(computeCurrentStreak(await loadStreaks())).toBe(2);
  });

  it("does not break the streak when today is missing entirely (no record yet)", async () => {
    await setHistory([
      { date: daysAgo(2), complete: true, hadObligations: true },
      { date: daysAgo(1), complete: true, hadObligations: true },
    ]);
    expect(computeCurrentStreak(await loadStreaks())).toBe(2);
  });

  it("breaks the streak when yesterday was missed", async () => {
    await setHistory([
      { date: daysAgo(3), complete: true, hadObligations: true },
      { date: daysAgo(2), complete: true, hadObligations: true },
      { date: daysAgo(1), complete: false, hadObligations: true },
    ]);
    await recordToday(true, true);
    expect(computeCurrentStreak(await loadStreaks())).toBe(1);
  });

  it("breaks the streak when a past day has no record (gap)", async () => {
    await setHistory([
      { date: daysAgo(3), complete: true, hadObligations: true },
      { date: daysAgo(1), complete: true, hadObligations: true },
    ]);
    await recordToday(true, true);
    expect(computeCurrentStreak(await loadStreaks())).toBe(2);
  });
});
