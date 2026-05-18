import { beforeEach, describe, expect, it } from "vitest";
import Dexie from "dexie";
import { computeRating, loadAbility, saveAbility, rebuildRatingResult } from "./useAbility";
import { db } from "../utils/db";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await Dexie.delete(`language-lab`);
});

describe("loadAbility / saveAbility", () => {
  it("returns null when nothing is saved", async () => {
    expect(await loadAbility(`French`, `reading`)).toBeNull();
  });

  it("round-trips a saved value, clamped to [1, 100]", async () => {
    await saveAbility(`French`, 45, `reading`);
    expect(await loadAbility(`French`, `reading`)).toBe(45);
    await saveAbility(`French`, 999, `reading`);
    expect(await loadAbility(`French`, `reading`)).toBe(100);
  });

  it("isolates ratings per mode and per language", async () => {
    await saveAbility(`French`, 70, `reading`);
    await saveAbility(`French`, 30, `writing`);
    await saveAbility(`Spanish`, 50, `reading`);
    expect(await loadAbility(`French`, `reading`)).toBe(70);
    expect(await loadAbility(`French`, `writing`)).toBe(30);
    expect(await loadAbility(`Spanish`, `reading`)).toBe(50);
    expect(await loadAbility(`Spanish`, `writing`)).toBeNull();
  });
});

describe("computeRating — placement", () => {
  it("anchors the rating at language complexity with a small ±2.5 nudge on the first assessment", async () => {
    const win = await computeRating(`French`, 10, 10, 30, `reading`);
    expect(win.isPlacement).toBe(true);
    expect(win.oldRating).toBeNull();
    expect(win.newRating).toBe(32.5);

    await Dexie.delete(`language-lab`);
    const draw = await computeRating(`French`, 7, 10, 30, `reading`);
    expect(draw.newRating).toBe(30);

    await Dexie.delete(`language-lab`);
    const loss = await computeRating(`French`, 3, 10, 30, `reading`);
    expect(loss.newRating).toBe(27.5);
  });

  it("clamps placement to [1, 100]", async () => {
    const low = await computeRating(`French`, 0, 10, 1, `reading`);
    expect(low.newRating).toBeGreaterThanOrEqual(1);

    await Dexie.delete(`language-lab`);
    const high = await computeRating(`French`, 10, 10, 100, `reading`);
    expect(high.newRating).toBeLessThanOrEqual(100);
  });
});

describe("computeRating — incremental K shrinks with confidence", () => {
  it("matches the spec example: win at 25 then win at 75 → ~47", async () => {
    await computeRating(`French`, 10, 10, 25, `reading`);
    const second = await computeRating(`French`, 10, 10, 75, `reading`);
    expect(second.isPlacement).toBe(false);
    expect(second.newRating).toBeGreaterThan(45);
    expect(second.newRating).toBeLessThan(50);
  });

  it("produces large swings when confidence is low and small swings when high", async () => {
    await computeRating(`French`, 10, 10, 50, `reading`);
    const r1 = (await loadAbility(`French`, `reading`))!;
    await computeRating(`French`, 10, 10, 50, `reading`);
    const r2 = (await loadAbility(`French`, `reading`))!;
    const swing2 = r2 - r1;
    for (let i = 0; i < 20; i++) {
      await computeRating(`French`, 7, 10, 50, `reading`);
    }
    const rN = (await loadAbility(`French`, `reading`))!;
    await computeRating(`French`, 10, 10, 50, `reading`);
    const rNext = (await loadAbility(`French`, `reading`))!;
    const swingN = rNext - rN;
    expect(Math.abs(swingN)).toBeLessThan(Math.abs(swing2));
  });
});

describe("computeRating — time decay", () => {
  it("decays confidence over time so an old user gets near-K_MAX swings again", async () => {
    for (let i = 0; i < 5; i++) {
      await computeRating(`French`, 10, 10, 50, `reading`);
    }
    const ratingBefore = (await loadAbility(`French`, `reading`))!;

    // Simulate 2 years passing by rewinding the stored confidence timestamp.
    const id = `French|reading`;
    const row = await db().abilities.get(id);
    await db().abilities.put({
      ...row!,
      confidenceUpdatedAt: row!.confidenceUpdatedAt - 2 * 365 * DAY,
    });

    const result = await computeRating(`French`, 10, 10, 80, `reading`);
    const swing = result.newRating - ratingBefore;
    expect(swing).toBeGreaterThan(15);
  });

  it("does not decay when assessments are back-to-back", async () => {
    await computeRating(`French`, 10, 10, 50, `reading`);
    await computeRating(`French`, 10, 10, 50, `reading`);
    const ratingAfter2 = (await loadAbility(`French`, `reading`))!;
    await computeRating(`French`, 10, 10, 50, `reading`);
    const ratingAfter3 = (await loadAbility(`French`, `reading`))!;
    const swing3 = ratingAfter3 - ratingAfter2;
    expect(swing3).toBeLessThan(15);
  });
});

describe("computeRating — mode and language isolation", () => {
  it("keeps separate state per (mode, language)", async () => {
    await computeRating(`French`, 10, 10, 30, `reading`);
    await computeRating(`Spanish`, 10, 10, 70, `reading`);
    await computeRating(`French`, 10, 10, 30, `listening`);

    expect(await loadAbility(`French`, `reading`)).toBe(32.5);
    expect(await loadAbility(`Spanish`, `reading`)).toBe(72.5);
    expect(await loadAbility(`French`, `listening`)).toBe(32.5);
    expect(await loadAbility(`French`, `writing`)).toBeNull();
  });
});

describe("rebuildRatingResult", () => {
  it("returns null when ratingAfter is null", () => {
    expect(
      rebuildRatingResult({ scoreEarned: 5, scoreMax: 10, ratingBefore: 50, ratingAfter: null }),
    ).toBeNull();
  });

  it("derives outcome from score percentage", () => {
    expect(
      rebuildRatingResult({ scoreEarned: 10, scoreMax: 10, ratingBefore: 50, ratingAfter: 55 })
        ?.outcome,
    ).toBe(`win`);
    expect(
      rebuildRatingResult({ scoreEarned: 7, scoreMax: 10, ratingBefore: 50, ratingAfter: 50 })
        ?.outcome,
    ).toBe(`draw`);
    expect(
      rebuildRatingResult({ scoreEarned: 3, scoreMax: 10, ratingBefore: 50, ratingAfter: 45 })
        ?.outcome,
    ).toBe(`loss`);
  });

  it("marks placement when ratingBefore is null", () => {
    const r = rebuildRatingResult({
      scoreEarned: 8,
      scoreMax: 10,
      ratingBefore: null,
      ratingAfter: 50,
    });
    expect(r?.isPlacement).toBe(true);
    expect(r?.change).toBe(0);
  });
});
